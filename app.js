import { DB } from './db.js';
import {
  CycleState, TokenStatus, newAccount, reconcile,
  registerFirstMessage, markExhausted, markAvailable,
  manualReset, setCycleDuration, setNextReset, formatRemaining
} from './timer.js';
import {
  getPrefs, setPrefs, requestPermission, notify,
  registerServiceWorker, scheduleLocalReminders
} from './notifications.js';

let accounts = [];
let editingId = null;
let cancelReminders = [];

const $ = (sel) => document.querySelector(sel);

async function loadAndReconcile() {
  accounts = await DB.getAll();
  let changed = false;
  for (const acc of accounts) {
    const before = JSON.stringify(acc);
    reconcile(acc);
    if (JSON.stringify(acc) !== before) changed = true;
  }
  if (changed) {
    for (const acc of accounts) await DB.put(acc);
  }
  accounts.sort((a, b) => (a.nextResetAt || Infinity) - (b.nextResetAt || Infinity));
  render();
  rearmReminders();
}

function rearmReminders() {
  cancelReminders.forEach((fn) => fn());
  cancelReminders = [];
  const prefs = getPrefs();
  for (const acc of accounts) {
    if (acc.cycleState === CycleState.ACTIVE) {
      cancelReminders.push(scheduleLocalReminders(acc, prefs));
    }
  }
}

function cycleBadge(acc) {
  switch (acc.cycleState) {
    case CycleState.ACTIVE: return '<span class="badge active">Activo</span>';
    case CycleState.WAITING_FIRST_MESSAGE: return '<span class="badge waiting">Esperando 1er mensaje</span>';
    default: return '<span class="badge none">Sin ciclo</span>';
  }
}

function tokenBadge(acc) {
  return acc.tokenStatus === TokenStatus.EXHAUSTED
    ? '<span class="badge exhausted">Tokens agotados</span>'
    : '<span class="badge available">Tokens disponibles</span>';
}

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('es', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

function render() {
  renderSummary();
  const list = $('#accountList');
  if (accounts.length === 0) {
    list.innerHTML = '<div class="empty">No tienes cuentas todavía.<br>Toca el botón + para agregar una.</div>';
    return;
  }
  list.innerHTML = accounts.map(cardHTML).join('');
  accounts.forEach((acc) => bindCardActions(acc));
}

function renderSummary() {
  const total = accounts.length;
  const active = accounts.filter((a) => a.cycleState === CycleState.ACTIVE).length;
  const exhausted = accounts.filter((a) => a.tokenStatus === TokenStatus.EXHAUSTED).length;
  const waiting = accounts.filter((a) => a.cycleState === CycleState.WAITING_FIRST_MESSAGE).length;
  $('#summary').innerHTML = `
    <div class="stat"><div class="n">${total}</div><div class="l">Cuentas</div></div>
    <div class="stat"><div class="n">${active}</div><div class="l">Activas</div></div>
    <div class="stat"><div class="n">${exhausted}</div><div class="l">Agotadas</div></div>
    <div class="stat"><div class="n">${waiting}</div><div class="l">Esperando 1er mensaje</div></div>
  `;
}

function cardHTML(acc) {
  return `
  <div class="card" style="border-left-color:${acc.color}" data-id="${acc.id}">
    <div class="row-top">
      <div class="name">${escapeHTML(acc.name)}</div>
      <div>${tokenBadge(acc)}</div>
    </div>
    <div>${cycleBadge(acc)}</div>
    <div class="countdown" data-countdown="${acc.id}">${formatRemaining(acc.nextResetAt)}</div>
    <div class="subtext">
      Próximo corte: ${fmt(acc.nextResetAt)}<br>
      Primer mensaje: ${fmt(acc.intervalStartedAt)}
    </div>
    <div class="actions">
      <button class="primary" data-act="tokensAvailable">Todavía tengo tokens</button>
      <button class="ghost" data-act="tokensExhausted">Agoté los tokens</button>
      <button class="primary" data-act="firstMessage">Registrar 1er mensaje</button>
      <button class="ghost" data-act="manualReset">Reiniciar ciclo</button>
      <button class="ghost" data-act="editReset">Cambiar corte</button>
      <button class="ghost" data-act="editAccount">Editar</button>
      <button class="ghost" data-act="history">Historial</button>
      <button class="danger" data-act="delete">Eliminar</button>
    </div>
  </div>`;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function bindCardActions(acc) {
  const card = document.querySelector(`.card[data-id="${acc.id}"]`);
  if (!card) return;
  card.querySelectorAll('button[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => handleAction(acc.id, btn.dataset.act));
  });
}

async function handleAction(id, act) {
  const acc = accounts.find((a) => a.id === id);
  if (!acc) return;
  switch (act) {
    case 'tokensAvailable':
      markAvailable(acc); break;
    case 'tokensExhausted':
      markExhausted(acc);
      if (getPrefs().onExhausted) notify(`${acc.name}: tokens agotados`, 'El corte sigue igual.');
      break;
    case 'firstMessage':
      registerFirstMessage(acc);
      if (getPrefs().onFirstMessage) notify(`${acc.name}: primer mensaje registrado`, `Próximo corte: ${fmt(acc.nextResetAt)}`);
      break;
    case 'manualReset':
      manualReset(acc); break;
    case 'editReset':
      openResetSheet(acc); return;
    case 'editAccount':
      openAccountSheet(acc); return;
    case 'history':
      openHistorySheet(acc); return;
    case 'delete':
      if (confirm(`¿Eliminar "${acc.name}"? Esto no se puede deshacer.`)) {
        await DB.delete(acc.id);
        await loadAndReconcile();
      }
      return;
  }
  await DB.put(acc);
  await loadAndReconcile();
}

// ---------- Sheet: agregar / editar cuenta ----------
function openAccountSheet(acc) {
  editingId = acc ? acc.id : null;
  $('#sheetAccountTitle').textContent = acc ? 'Editar cuenta' : 'Nueva cuenta';
  $('#fName').value = acc ? acc.name : '';
  $('#fColor').value = acc ? acc.color : '#7c9cff';
  $('#fDuration').value = acc ? acc.cycleDurationMinutes : 300;
  toggleSheet('sheetAccount', 'backdropAccount', true);
}

async function saveAccount() {
  const name = $('#fName').value.trim();
  const color = $('#fColor').value.trim() || '#7c9cff';
  const duration = parseInt($('#fDuration').value, 10) || 300;
  if (!name) { alert('Escribe un nombre.'); return; }

  if (editingId) {
    const acc = accounts.find((a) => a.id === editingId);
    acc.name = name;
    acc.color = color;
    if (acc.cycleDurationMinutes !== duration) setCycleDuration(acc, duration);
    await DB.put(acc);
  } else {
    const acc = newAccount({ name, color, cycleDurationMinutes: duration });
    await DB.put(acc);
  }
  toggleSheet('sheetAccount', 'backdropAccount', false);
  await loadAndReconcile();
}

// ---------- Sheet: cambiar próximo corte ----------
let resetTargetId = null;
function openResetSheet(acc) {
  resetTargetId = acc.id;
  const d = acc.nextResetAt ? new Date(acc.nextResetAt) : new Date();
  $('#fResetAt').value = toLocalInputValue(d);
  toggleSheet('sheetReset', 'backdropReset', true);
}

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function saveReset() {
  const val = $('#fResetAt').value;
  if (!val) { alert('Elige una fecha y hora.'); return; }
  const ts = new Date(val).getTime();
  const acc = accounts.find((a) => a.id === resetTargetId);
  setNextReset(acc, ts);
  await DB.put(acc);
  toggleSheet('sheetReset', 'backdropReset', false);
  await loadAndReconcile();
}

// ---------- Sheet: historial ----------
function openHistorySheet(acc) {
  const items = [...(acc.history || [])].reverse();
  $('#historyList').innerHTML = items.length
    ? items.map((h) => `<div class="history-item"><span>${labelForEvent(h.type)}</span><span class="t">${fmt(h.timestamp)}</span></div>`).join('')
    : '<div class="empty">Sin eventos todavía.</div>';
  toggleSheet('sheetHistory', 'backdropHistory', true);
}

function labelForEvent(type) {
  const map = {
    RESET_DUE: 'Corte alcanzado',
    FIRST_MESSAGE: 'Primer mensaje',
    TOKENS_EXHAUSTED: 'Tokens agotados',
    TOKENS_AVAILABLE: 'Tokens disponibles',
    MANUAL_RESET: 'Reinicio manual',
    ACCOUNT_CREATED: 'Cuenta creada',
    ACCOUNT_EDITED: 'Cuenta editada'
  };
  return map[type] || type;
}

function toggleSheet(sheetId, backdropId, open) {
  $(`#${sheetId}`).classList.toggle('open', open);
  $(`#${backdropId}`).classList.toggle('open', open);
}

// ---------- Countdown tick (solo redibuja, no es fuente de verdad) ----------
function tickCountdowns() {
  document.querySelectorAll('[data-countdown]').forEach((el) => {
    const id = el.dataset.countdown;
    const acc = accounts.find((a) => a.id === id);
    if (acc) el.textContent = formatRemaining(acc.nextResetAt);
  });
}

// ---------- Export / Import / Reset ----------
async function exportData() {
  const json = await DB.exportJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `token-manager-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData() {
  $('#fileImport').click();
}

async function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    const count = await DB.importJSON(text);
    alert(`Se importaron ${count} cuenta(s).`);
    await loadAndReconcile();
  } catch (err) {
    alert('No se pudo importar: ' + err.message);
  }
  e.target.value = '';
}

async function resetAllData() {
  if (!confirm('Esto borra TODAS las cuentas y su historial. ¿Seguro?')) return;
  await DB.clearAll();
  await loadAndReconcile();
}

// ---------- Wiring de botones fijos ----------
function wireStaticButtons() {
  $('#btnAdd').addEventListener('click', () => openAccountSheet(null));
  $('#btnCancelAccount').addEventListener('click', () => toggleSheet('sheetAccount', 'backdropAccount', false));
  $('#btnSaveAccount').addEventListener('click', saveAccount);
  $('#backdropAccount').addEventListener('click', () => toggleSheet('sheetAccount', 'backdropAccount', false));

  $('#btnCancelReset').addEventListener('click', () => toggleSheet('sheetReset', 'backdropReset', false));
  $('#btnSaveReset').addEventListener('click', saveReset);
  $('#backdropReset').addEventListener('click', () => toggleSheet('sheetReset', 'backdropReset', false));

  $('#btnCloseHistory').addEventListener('click', () => toggleSheet('sheetHistory', 'backdropHistory', false));
  $('#backdropHistory').addEventListener('click', () => toggleSheet('sheetHistory', 'backdropHistory', false));

  $('#btnExport').addEventListener('click', exportData);
  $('#btnImport').addEventListener('click', importData);
  $('#fileImport').addEventListener('change', handleImportFile);
  $('#btnResetAll').addEventListener('click', resetAllData);
  $('#btnNotif').addEventListener('click', async () => {
    const perm = await requestPermission();
    alert(perm === 'granted' ? 'Avisos activados.' : 'No se activaron los avisos.');
  });
}

// ---------- Arranque ----------
async function init() {
  wireStaticButtons();
  await registerServiceWorker();
  await loadAndReconcile();

  // Redibuja el número cada segundo (solo visual).
  setInterval(tickCountdowns, 1000);
  // Revisa cada 5 segundos si algún corte ya llegó (fuente de verdad = timestamps).
  setInterval(loadAndReconcile, 5000);
  // Al volver a la app (por ejemplo, tras desbloquear el teléfono), reconcilia ya mismo.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') loadAndReconcile();
  });
}

init();
