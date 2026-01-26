// ShopEasy Service Worker v2.0
const CACHE_NAME = 'shopeasy-cache-v2';
const APP_VERSION = '1.0.1';

// Assets to cache immediately
const PRECACHE_ASSETS = [
  './',
  './index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('🔄 Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('✅ Cache opened:', CACHE_NAME);
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('✅ Pre-cached assets');
        return self.skipWaiting(); // Activate immediately
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Claiming clients');
      return self.clients.claim(); // Take control of all tabs
    })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip Chrome extensions
  if (event.request.url.startsWith('chrome-extension://')) return;
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Otherwise fetch from network
        return fetch(event.request)
          .then((networkResponse) => {
            // Don't cache non-successful responses
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            
            // Clone the response to cache it
            const responseToCache = networkResponse.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                // Cache successful responses (except for Firebase/API calls)
                if (!event.request.url.includes('firebase') && 
                    !event.request.url.includes('googleapis')) {
                  cache.put(event.request, responseToCache);
                }
              });
            
            return networkResponse;
          })
          .catch(() => {
            // If network fails and we don't have a cache, return offline page
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            return new Response('Network error occurred', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data.action === 'skipWaiting') {
    console.log('🔄 Skipping waiting phase');
    self.skipWaiting();
  }
  
  if (event.data.action === 'versionCheck') {
    console.log('📱 Version check:', event.data.version);
    if (event.data.version !== APP_VERSION) {
      self.skipWaiting();
    }
  }
  
  if (event.data.action === 'CLEAR_CACHE') {
    console.log('🗑️ Clearing all caches for version:', event.data.version);
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => {
        caches.delete(cacheName);
      });
    });
  }
});

// Background sync for offline orders
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    console.log('🔄 Background sync for orders');
    event.waitUntil(syncOrders());
  }
});

async function syncOrders() {
  // Implement order synchronization here
  console.log('🔄 Syncing offline orders...');
}
