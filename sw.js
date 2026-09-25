// sw.js — Service worker: cachea la app para que abra rápido y funcione sin internet.
// La parte de "push" está lista, pero solo funciona si un servidor real la activa
// con claves VAPID (ver README, sección Web Push).

const CACHE_NAME = 'token-manager-cache-v1';
// Rutas relativas al scope del service worker: funcionan también dentro de
// https://usuario.github.io/repositorio/
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './timer.js',
  './notifications.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => cached))
  );
});

// Si algún día tienes un servidor de Web Push real, esto ya sabe qué hacer
// cuando llegue un push.
self.addEventListener('push', (event) => {
  let data = { title: 'Token Manager', body: 'Tienes una novedad.' };
  try {
    if (event.data) data = event.data.json();
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Token Manager', {
      body: data.body || '',
      icon: './icons/icon-192.png'
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow('./');
    })
  );
});
