// sw.js - Service Worker for ShopEasy PWA
const CACHE_NAME = 'shopeasy-v1.0.1';
const STATIC_CACHE = [
  '/', // Main page
  '/index.html', // Main HTML file
  'logo.png',
  'manifest.json'
];

const DYNAMIC_CACHE = 'shopeasy-dynamic-v1';

// External resources to cache
const EXTERNAL_RESOURCES = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll([
          ...STATIC_CACHE,
          ...EXTERNAL_RESOURCES
        ]);
      })
      .then(() => {
        console.log('[Service Worker] Install completed');
        return self.skipWaiting();
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
  
  // Skip cross-origin requests and non-GET requests
  if (!event.request.url.startsWith(self.location.origin) || event.request.method !== 'GET') {
    return;
  }
  
  // For HTML pages - Network First, then Cache
  if (event.request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the HTML page
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE)
            .then((cache) => {
              cache.put(event.request, responseClone);
            });
          return response;
        })
        .catch(() => {
          return caches.match(event.request)
            .then((cachedResponse) => {
              return cachedResponse || caches.match('/');
            });
        })
    );
    return;
  }
  
  // For CSS, JS, and images - Cache First, then Network
  if (event.request.url.match(/\.(css|js|png|jpg|jpeg|gif|svg)$/)) {
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached version
            return cachedResponse;
          }
          
          // Fetch from network
          return fetch(event.request)
            .then((response) => {
              // Don't cache if not a valid response
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              // Cache the fetched resource
              const responseToCache = response.clone();
              caches.open(DYNAMIC_CACHE)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
              
              return response;
            })
            .catch((error) => {
              console.log('[Service Worker] Fetch failed:', error);
              // For images, return a placeholder
              if (event.request.url.match(/\.(png|jpg|jpeg|gif)$/)) {
                return caches.match('logo.png');
              }
            });
        })
    );
    return;
  }
  
  // For Firebase data - Cache First, Network Update
  if (url.hostname.includes('firestore.googleapis.com') || 
      url.hostname.includes('firebasestorage.googleapis.com')) {
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          // Try to fetch fresh data in background
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              // Update cache with fresh data
              const responseClone = networkResponse.clone();
              caches.open(DYNAMIC_CACHE)
                .then((cache) => {
                  cache.put(event.request, responseClone);
                });
              return networkResponse;
            })
            .catch(() => {
              // Network failed, do nothing
            });
          
          // Return cached response immediately, then update
          return cachedResponse || fetchPromise;
        })
    );
    return;
  }
});

// Background sync for orders when offline
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    console.log('[Service Worker] Syncing orders...');
    event.waitUntil(syncOrders());
  }
});

async function syncOrders() {
  // This would sync pending orders when back online
  console.log('[Service Worker] Syncing pending orders');
}

// Periodic sync for product updates
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-products') {
    console.log('[Service Worker] Periodic sync for products');
    event.waitUntil(updateProducts());
  }
});

async function updateProducts() {
  // Update products in background
  console.log('[Service Worker] Updating products cache');
}

// Message handler for cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'CLEAR_CACHE') {
    console.log('[Service Worker] Clearing cache for version:', event.data.version);
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    });
  }
  
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
