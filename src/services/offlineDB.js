import { openDB } from 'idb';

const DB_NAME = 'catastro_offline_db';
const STORE_NAME = 'offline_predios';

export const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'offline_id' });
      }
    },
  });
};

export const saveOfflinePredio = async (predioData) => {
  const db = await initDB();
  // Ensure we keep the offline_id if editing an already offline predio
  const offlineId = predioData.offline_id || `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const payload = { ...predioData, offline_id: offlineId, timestamp: Date.now() };
  await db.put(STORE_NAME, payload);
  return payload;
};

export const getOfflinePredios = async () => {
  const db = await initDB();
  return db.getAll(STORE_NAME);
};

export const removeOfflinePredio = async (offlineId) => {
  const db = await initDB();
  return db.delete(STORE_NAME, offlineId);
};

export const getOfflinePredioById = async (offlineId) => {
  const db = await initDB();
  return db.get(STORE_NAME, offlineId);
};
