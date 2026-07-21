import type { CardTemplateDefinition } from './types';

const DB_NAME = 'ciptea-template-engine';
const STORE_NAME = 'templates';
const ACTIVE_KEY = 'active-template';
const FALLBACK_KEY = 'ciptea.active-template';

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha ao abrir o armazenamento local.'));
  });
}

export async function saveActiveTemplate(template: CardTemplateDefinition) {
  if (typeof indexedDB === 'undefined') {
    globalThis.localStorage?.setItem(FALLBACK_KEY, JSON.stringify(template));
    window.dispatchEvent(new CustomEvent('ciptea-template-updated'));
    return;
  }
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(template, ACTIVE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Falha ao salvar o modelo.'));
  });
  database.close();
  window.dispatchEvent(new CustomEvent('ciptea-template-updated'));
}

export async function loadActiveTemplate() {
  if (typeof indexedDB === 'undefined') {
    const raw = globalThis.localStorage?.getItem(FALLBACK_KEY);
    return raw ? JSON.parse(raw) as CardTemplateDefinition : undefined;
  }
  const database = await openDatabase();
  const value = await new Promise<CardTemplateDefinition | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(ACTIVE_KEY);
    request.onsuccess = () => resolve(request.result as CardTemplateDefinition | undefined);
    request.onerror = () => reject(request.error ?? new Error('Falha ao carregar o modelo.'));
  });
  database.close();
  return value;
}

export async function clearActiveTemplate() {
  if (typeof indexedDB === 'undefined') {
    globalThis.localStorage?.removeItem(FALLBACK_KEY);
    window.dispatchEvent(new CustomEvent('ciptea-template-updated'));
    return;
  }
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(ACTIVE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Falha ao remover o modelo.'));
  });
  database.close();
  window.dispatchEvent(new CustomEvent('ciptea-template-updated'));
}

export function downloadTemplateJson(template: CardTemplateDefinition) {
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${template.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-') || 'modelo-ciptea'}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importTemplateJson(file: File) {
  const parsed = JSON.parse(await file.text()) as CardTemplateDefinition;
  if (!parsed?.id || !Array.isArray(parsed.fields)) {
    throw new Error('O arquivo JSON não contém um modelo válido.');
  }
  return parsed;
}
