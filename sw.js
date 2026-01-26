// sw.js - Service Worker for ShopEasy PWA
const APP_VERSION = '1.0.1';
const CACHE_NAME = `shopeasy-v${APP_VERSION}`;
const OFFLINE_PAGE = '/offline.html';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  'logo.png',
  'manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js'
];

// Dynamic cache for API responses and images
const DYNAMIC_CACHE = 'shopeasy-dynamic-v1';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing version:', APP_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] All assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Cache installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches that don't match current version
          if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests and cross-origin requests (except CDNs)
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Handle different types of requests
  if (event.request.headers.get('Accept')?.includes('text/html')) {
    // HTML requests: Network first, fallback to cache
    event.respondWith(
      networkFirst(event.request)
    );
  } else if (event.request.url.match(/\.(css|js|woff|woff2)$/)) {
    // CSS and JS: Cache first, network fallback
    event.respondWith(
      cacheFirst(event.request)
    );
  } else if (event.request.url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) {
    // Images: Cache first, with placeholder fallback
    event.respondWith(
      imageCacheFirst(event.request)
    );
  } else if (url.hostname.includes('firestore.googleapis.com') || 
             url.hostname.includes('firebasestorage.googleapis.com')) {
    // Firebase data: Network first, cache fallback
    event.respondWith(
      networkFirstWithCacheUpdate(event.request)
    );
  } else {
    // Default: Network first, cache fallback
    event.respondWith(
      networkFirst(event.request)
    );
  }
});

// Network First strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache the response for future use
    const cache = await caches.open(DYNAMIC_CACHE);
    cache.put(request, networkResponse.clone());
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      console.log('[Service Worker] Serving from cache:', request.url);
      return cachedResponse;
    }
    
    // If it's an HTML request and we have no cache, show offline page
    if (request.headers.get('Accept')?.includes('text/html')) {
      return caches.match('/');
    }
    
    throw error;
  }
}

// Cache First strategy
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    // Cache the response
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // If everything fails, return a fallback for CSS/JS
    if (request.url.match(/\.css$/)) {
      return new Response('', { headers: { 'Content-Type': 'text/css' } });
    }
    
    if (request.url.match(/\.js$/)) {
      return new Response('console.log("Offline mode");', { 
        headers: { 'Content-Type': 'application/javascript' } 
      });
    }
    
    throw error;
  }
}

// Image Cache First with placeholder fallback
async function imageCacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful image responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Return a placeholder image for product images
    if (request.url.includes('placeholder') || request.url.includes('postimg.cc')) {
      return caches.match('logo.png');
    }
    
    // For other images, create a simple SVG placeholder
    const placeholderSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="100%" height="100%" fill="#f0f0f0"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999" font-family="sans-serif" font-size="14">
          Image
        </text>
      </svg>
    `;
    
    return new Response(placeholderSvg, {
      headers: { 'Content-Type': 'image/svg+xml' }
    });
  }
}

// Network first with cache update for dynamic data
async function networkFirstWithCacheUpdate(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Update cache with fresh data
    const cache = await caches.open(DYNAMIC_CACHE);
    cache.put(request, networkResponse.clone());
    
    return networkResponse;
  } catch (error) {
    // If network fails, try to serve from cache
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      console.log('[Service Worker] Serving Firebase data from cache');
      return cachedResponse;
    }
    
    // If no cache, return empty response
    if (request.url.includes('firestore.googleapis.com')) {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    throw error;
  }
}

// Background sync for pending orders
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    console.log('[Service Worker] Background sync: Processing pending orders');
    event.waitUntil(syncPendingOrders());
  }
});

// Sync pending orders when back online
async function syncPendingOrders() {
  // This would sync any pending orders stored in IndexedDB
  console.log('[Service Worker] Syncing pending orders...');
}

// Periodic sync for data updates
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-products') {
    console.log('[Service Worker] Periodic sync for products');
    event.waitUntil(updateProductCache());
  }
});

// Update product cache in background
async function updateProductCache() {
  try {
    // This would fetch fresh product data
    console.log('[Service Worker] Background product update');
  } catch (error) {
    console.error('[Service Worker] Background sync failed:', error);
  }
}

// Handle messages from the client
self.addEventListener('message', (event) => {
  const message = event.data;
  
  if (message.action === 'skipWaiting') {
    self.skipWaiting();
  }
  
  if (message.action === 'CLEAR_CACHE') {
    console.log('[Service Worker] Clearing cache for version:', message.version);
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    });
  }
  
  if (message.action === 'versionCheck') {
    console.log('[Service Worker] Version check:', message.version);
    event.source.postMessage({
      action: 'versionResponse',
      version: APP_VERSION
    });
  }
});

// Handle push notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'New update from ShopEasy',
      icon: 'logo.png',
      badge: 'logo.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'ShopEasy', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
