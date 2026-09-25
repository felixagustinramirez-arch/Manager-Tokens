// timer.js — Aquí vive la regla de las 5 horas. Todo se calcula con fechas (Date.now()),
// nunca con un reloj que "cuenta" por su cuenta. Eso hace que funcione aunque
// cierres la app, bloquees el teléfono o cambies la hora.

export const CycleState = {
  NO_SCHEDULE: 'NO_SCHEDULE',
  WAITING_FIRST_MESSAGE: 'WAITING_FIRST_MESSAGE',
  ACTIVE: 'ACTIVE'
};

export const TokenStatus = {
  AVAILABLE: 'AVAILABLE',
  EXHAUSTED: 'EXHAUSTED'
};

export function newAccount({ name, color, cycleDurationMinutes = 300 }) {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    color: color || '#7c9cff',
    enabled: true,
    cycleDurationMinutes,
    nextResetAt: null,
    intervalStartedAt: null,
    tokenStatus: TokenStatus.AVAILABLE,
    cycleState: CycleState.NO_SCHEDULE,
    createdAt: now,
    updatedAt: now,
    history: [{ type: 'ACCOUNT_CREATED', timestamp: now }]
  };
}

function log(account, type, extra = {}) {
  account.history = account.history || [];
  account.history.push({ type, timestamp: Date.now(), ...extra });
  account.updatedAt = Date.now();
}

// Se llama al abrir la app y cada vez que pasa el tiempo. NUNCA arranca un intervalo solo.
// Solo apaga el corte vencido y pone la cuenta en "esperando primer mensaje".
export function reconcile(account) {
  const now = Date.now();
  if (account.cycleState === CycleState.ACTIVE && account.nextResetAt && now >= account.nextResetAt) {
    log(account, 'RESET_DUE', { resetAt: account.nextResetAt });
    account.cycleState = CycleState.WAITING_FIRST_MESSAGE;
    account.tokenStatus = TokenStatus.AVAILABLE;
    account.intervalStartedAt = null;
    account.nextResetAt = null; // el próximo corte no existe hasta el primer mensaje
  }
  return account;
}

export function registerFirstMessage(account, timestamp = Date.now()) {
  account.intervalStartedAt = timestamp;
  account.nextResetAt = timestamp + account.cycleDurationMinutes * 60000;
  account.cycleState = CycleState.ACTIVE;
  account.tokenStatus = TokenStatus.AVAILABLE;
  log(account, 'FIRST_MESSAGE', { at: timestamp });
  return account;
}

export function markExhausted(account) {
  account.tokenStatus = TokenStatus.EXHAUSTED;
  log(account, 'TOKENS_EXHAUSTED');
  // Importante: NO se toca nextResetAt.
  return account;
}

export function markAvailable(account) {
  account.tokenStatus = TokenStatus.AVAILABLE;
  log(account, 'TOKENS_AVAILABLE');
  return account;
}

export function manualReset(account) {
  account.cycleState = CycleState.WAITING_FIRST_MESSAGE;
  account.tokenStatus = TokenStatus.AVAILABLE;
  account.intervalStartedAt = null;
  account.nextResetAt = null;
  log(account, 'MANUAL_RESET');
  return account;
}

export function setCycleDuration(account, minutes) {
  account.cycleDurationMinutes = minutes;
  log(account, 'ACCOUNT_EDITED', { field: 'cycleDurationMinutes', value: minutes });
  return account;
}

export function setNextReset(account, timestamp) {
  account.nextResetAt = timestamp;
  if (account.cycleState === CycleState.NO_SCHEDULE) {
    account.cycleState = CycleState.ACTIVE;
  }
  log(account, 'ACCOUNT_EDITED', { field: 'nextResetAt', value: timestamp });
  return account;
}

// Texto de cuenta regresiva, listo para mostrar. Se recalcula cada segundo desde afuera,
// pero siempre a partir de nextResetAt (nunca acumulando segundos por su cuenta).
export function formatRemaining(nextResetAt) {
  if (!nextResetAt) return '—';
  const diff = nextResetAt - Date.now();
  if (diff <= 0) return '00:00:00';
  const totalSeconds = Math.floor(diff / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}
