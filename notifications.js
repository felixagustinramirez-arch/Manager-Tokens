// notifications.js — Avisos mientras la app está abierta o recién cerrada.
// IMPORTANTE (léelo, es honesto): un iPhone con la app totalmente cerrada
// NO puede "despertar sola" para avisarte, salvo que exista un servidor de
// verdad enviando un Web Push real con claves VAPID. Este archivo deja el
// código listo para eso, pero GitHub Pages por sí solo no envía push.

const PREFS_KEY = 'tm_notification_prefs_v1';

export const defaultPrefs = {
  before30: true,
  before10: true,
  atReset: true,
  onFirstMessage: true,
  onExhausted: true
};

export function getPrefs() {
  try {
    return { ...defaultPrefs, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch {
    return { ...defaultPrefs };
  }
}

export function setPrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission();
}

export function notify(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    // Se usa el service worker si existe para que la notificación sobreviva
    // un poco más incluso si la pestaña se está cerrando.
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, { body, icon: 'icons/icon-192.png' }));
    } else {
      new Notification(title, { body, icon: 'icons/icon-192.png' });
    }
  } catch (e) {
    console.warn('No se pudo mostrar la notificación', e);
  }
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    // Ruta relativa: funciona también en GitHub Pages tipo /usuario/repo/
    const reg = await navigator.serviceWorker.register('./sw.js');
    return reg;
  } catch (e) {
    console.warn('No se pudo registrar el service worker', e);
    return null;
  }
}

// Programa avisos locales mientras la pestaña sigue abierta, comparando
// contra el timestamp real (no contando segundos por su cuenta).
// Devuelve una función para cancelar los timers si la cuenta cambia.
export function scheduleLocalReminders(account, prefs) {
  const timers = [];
  if (!account.nextResetAt) return () => timers.forEach(clearTimeout);
  const now = Date.now();
  const target = account.nextResetAt;

  const plan = [
    { key: 'before30', ms: target - 30 * 60000, title: `${account.name}: quedan 30 min`, body: 'El corte se acerca.' },
    { key: 'before10', ms: target - 10 * 60000, title: `${account.name}: quedan 10 min`, body: 'El corte está muy cerca.' },
    { key: 'atReset', ms: target, title: `${account.name}: llegó el corte`, body: 'Ahora está esperando el primer mensaje.' }
  ];

  for (const item of plan) {
    if (!prefs[item.key]) continue;
    const delay = item.ms - now;
    if (delay <= 0) continue;
    timers.push(setTimeout(() => notify(item.title, item.body), delay));
  }

  return () => timers.forEach(clearTimeout);
}
