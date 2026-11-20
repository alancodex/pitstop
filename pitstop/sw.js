/* PitStop — service worker: abre rápido e funciona como app. Nunca guarda dados de agendamento. */
const VERSION = 'pitstop-v3';
const SHELL = ['./', 'index.html', 'css/tokens.css', 'css/style.css', 'js/config.js', 'js/app.js', 'manifest.webmanifest',
  'assets/logo.png', 'assets/fonts/barlow-condensed-latin-800-normal.woff2', 'assets/fonts/barlow-condensed-latin-700-normal.woff2', 'assets/fonts/inter-latin-400-normal.woff2', 'assets/fonts/inter-latin-500-normal.woff2', 'assets/fonts/inter-latin-600-normal.woff2', 'assets/fonts/inter-latin-700-normal.woff2', 'assets/pattern.svg', 'assets/galeria/carro-jeep-azul-thumb.jpg', 'assets/galeria/moto-royal-enfield-thumb.jpg', 'assets/galeria/carro-hyundai-rodas-thumb.jpg', 'assets/galeria/carro-ka-branco-thumb.jpg', 'assets/galeria/moto-fan-vermelha-thumb.jpg'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;      // Supabase e fontes passam direto
  if (url.pathname.includes('/admin')) return;                              // admin nunca é cacheado
  if (req.mode === 'navigate') {                                            // páginas: rede primeiro
    e.respondWith(fetch(req).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.open(VERSION).then(async (c) => {                    // arquivos: cache + atualização em segundo plano
    const hit = await c.match(req);
    const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
