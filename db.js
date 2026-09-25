// db.js — Guarda todo en el teléfono. No usa internet. No guarda contraseñas.
const DB_NAME = 'token-manager-db';
const DB_VERSION = 1;
const STORE = 'accounts';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode) {
  const db = await openDB();
  return db.transaction(STORE, mode).objectStore(STORE);
}

export const DB = {
  async getAll() {
    const store = await tx('readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async put(account) {
    const store = await tx('readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(account);
      req.onsuccess = () => resolve(account);
      req.onerror = () => reject(req.error);
    });
  },

  async delete(id) {
    const store = await tx('readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async clearAll() {
    const store = await tx('readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  // Exporta todo a un JSON que el usuario puede guardar.
  async exportJSON() {
    const accounts = await DB.getAll();
    const payload = {
      app: 'token-manager',
      exportedAt: new Date().toISOString(),
      version: 1,
      accounts
    };
    return JSON.stringify(payload, null, 2);
  },

  // Valida y reemplaza todos los datos con lo que venga en el JSON importado.
  async importJSON(jsonText) {
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      throw new Error('El archivo no es un JSON válido.');
    }
    if (!parsed || !Array.isArray(parsed.accounts)) {
      throw new Error('El archivo no tiene el formato esperado (falta "accounts").');
    }
    for (const acc of parsed.accounts) {
      if (!acc.id || !acc.name) {
        throw new Error('Una cuenta del archivo no tiene id o nombre.');
      }
    }
    await DB.clearAll();
    for (const acc of parsed.accounts) {
      await DB.put(acc);
    }
    return parsed.accounts.length;
  }
};
