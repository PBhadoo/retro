const CACHE_NAME = 'retro-games-v3';
const ROM_CACHE_NAME = 'retro-roms-v2';
const APP_SHELL = [
    '/',
    '/index.html',
    '/nes/',
    '/nes/index.html',
    '/snes/',
    '/snes/index.html'
];

// Install: cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(APP_SHELL);
        })
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME && key !== ROM_CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Check if a request is for a ROM file
function isRomRequest(url) {
    const path = url.pathname;
    // NES ROMs
    if (path.startsWith('/roms/') && (path.endsWith('.nes') || path.endsWith('.NES'))) return true;
    // SNES ROMs
    if (path.startsWith('/snes-roms/') && (path.endsWith('.sfc') || path.endsWith('.smc') || path.endsWith('.SFC') || path.endsWith('.SMC'))) return true;
    return false;
}

// Fetch: serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // For ROM files, check ROM cache first
    if (isRomRequest(url)) {
        event.respondWith(
            caches.open(ROM_CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    return fetch(event.request);
                });
            })
        );
        return;
    }

    // For everything else, cache-first for app shell, network-first for others
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Return cached but also update in background
                fetch(event.request).then((response) => {
                    if (response && response.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, response);
                        });
                    }
                }).catch(() => {});
                return cachedResponse;
            }
            return fetch(event.request).then((response) => {
                if (!response || response.status !== 200) return response;
                // Cache successful responses for app resources
                if (url.origin === self.location.origin && !isRomRequest(url)) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            }).catch(() => {
                if (event.request.destination === 'document') {
                    return caches.match('/index.html');
                }
                return new Response('Offline', { status: 503, statusText: 'Offline' });
            });
        })
    );
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
    const { action, url } = event.data;

    if (action === 'cacheRom') {
        caches.open(ROM_CACHE_NAME).then((cache) => {
            fetch(url).then((response) => {
                if (response.ok) {
                    cache.put(url, response).then(() => {
                        event.source.postMessage({ action: 'romCached', url: url, success: true });
                    });
                } else {
                    event.source.postMessage({ action: 'romCached', url: url, success: false });
                }
            }).catch(() => {
                event.source.postMessage({ action: 'romCached', url: url, success: false });
            });
        });
    }

    if (action === 'uncacheRom') {
        caches.open(ROM_CACHE_NAME).then((cache) => {
            cache.delete(url).then(() => {
                event.source.postMessage({ action: 'romUncached', url: url });
            });
        });
    }

    if (action === 'getCachedRoms') {
        caches.open(ROM_CACHE_NAME).then((cache) => {
            cache.keys().then((keys) => {
                const urls = keys.map(req => req.url);
                event.source.postMessage({ action: 'cachedRomsList', urls: urls });
            });
        });
    }
});