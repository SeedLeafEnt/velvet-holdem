/* Velvet Hold'em service worker: lets the installed app start and play offline.
   Code (HTML/CSS/JS) is network-first, so a new version shows up as soon as you are online.
   Everything else (three.js, fonts, icons, voices) is cache-first.
   Bump VERSION when the file list changes. */
const VERSION = 'velvet-v1';
const JS = ['00-three', '01-core', '02-audio', '03-fx', '04-personas', '05-state', '06-engine3d', '07-people', '08-tricks', '09-career',
  '10-bar', '11-stage1', '12-casino', '13-talk-act', '14-render', '15-hud', '16-ai', '17-flow', '18-overlays', '19-boot'].map(n => `js/${n}.js`);
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'css/style.css', 'css/fonts.css', ...JS,
  'vendor/three/three.module.js', 'vendor/three/addons/environments/RoomEnvironment.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
  'fonts/BarlowCondensed-400.woff2', 'fonts/BarlowCondensed-500.woff2', 'fonts/BarlowCondensed-600.woff2', 'fonts/BarlowCondensed-700.woff2',
  'fonts/Limelight-400.woff2', 'fonts/SourceSerif4-700.woff2', 'fonts/SourceSerif4-800.woff2'];
const VOICES = ['dealer', 'maniac', 'pro', 'rock', 'shark', 'station'].map(n => `voice/${n}.mp3`);

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL);
    await Promise.all(VOICES.map(u => c.add(u).catch(() => {}))); // voices are optional
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});
const isCode = url => url.pathname.endsWith('/') || /\.(html|css|js|webmanifest)$/.test(url.pathname) && !url.pathname.includes('/vendor/');
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (isCode(url)) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
        return res;
      } catch (err) {
        return (await caches.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' && await caches.match('index.html')) || Response.error();
      }
    })());
  } else {
    e.respondWith((async () => {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.status === 200) (await caches.open(VERSION)).put(req, res.clone());
      return res;
    })());
  }
});
