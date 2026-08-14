const CACHE_NAME = 'pingo-shell-v0.8.0'
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/img.png',
  '/pingo-icon.svg',
  '/card-backgrounds/amazonia.svg',
  '/card-backgrounds/praia.svg',
  '/card-backgrounds/cidade.svg',
  '/card-backgrounds/montanhas.svg',
]

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME)
  await cache.addAll(SHELL)

  // O Vite cria nomes com hash para JS e CSS. Descobri-los no HTML garante
  // que a primeira instalação já possa reabrir o aplicativo sem internet.
  const index = await cache.match('/index.html')
  if (!index) return
  const html = await index.text()
  const assets = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)]
    .map((match) => match[1])
  if (assets.length) await cache.addAll([...new Set(assets)])
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('pingo-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy))
          return response
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
        return response
      })
      return cached || network
    }),
  )
})
