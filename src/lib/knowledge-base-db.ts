/**
 * Knowledge Base IndexedDB helper
 *
 * Stores knowledge base file contents per workspace.
 */

import type { KnowledgeBaseFileMeta } from '@/types';

const DB_NAME = 'projectloom-kb';
const DB_VERSION = 1;
const STORE_NAME = 'kb-files';

export interface KnowledgeBaseFileRecord extends KnowledgeBaseFileMeta {
  workspaceId: string;
  content: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('workspaceId', 'workspaceId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then((db) => {
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      const request = action(store);

      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));

      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('IndexedDB transaction failed'));
      };
    });
  });
}

export async function saveKnowledgeBaseFile(record: KnowledgeBaseFileRecord): Promise<void> {
  await withStore('readwrite', (store) => store.put(record));
}

export async function deleteKnowledgeBaseFile(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id));
}

export async function listKnowledgeBaseFiles(workspaceId: string): Promise<KnowledgeBaseFileMeta[]> {
  const records = await withStore('readonly', (store) => {
    const index = store.index('workspaceId');
    return index.getAll(workspaceId);
  });

  return (records as KnowledgeBaseFileRecord[]).map((record) => ({
    id: record.id,
    name: record.name,
    type: record.type,
    size: record.size,
    lastModified: record.lastModified,
  }));
}

export async function getKnowledgeBaseContents(
  workspaceId: string
): Promise<Array<{ id: string; name: string; content: string }>> {
  const records = await withStore('readonly', (store) => {
    const index = store.index('workspaceId');
    return index.getAll(workspaceId);
  });

  return (records as KnowledgeBaseFileRecord[]).map((record) => ({
    id: record.id,
    name: record.name,
    content: record.content,
  }));
}

export async function updateKnowledgeBaseFileMeta(
  id: string,
  updates: Partial<Pick<KnowledgeBaseFileRecord, 'name' | 'lastModified' | 'type' | 'size'>>
): Promise<void> {
  const record = await withStore('readonly', (store) => store.get(id));
  if (!record) {
    throw new Error('Knowledge base file not found');
  }

  const next: KnowledgeBaseFileRecord = {
    ...(record as KnowledgeBaseFileRecord),
    ...updates,
    lastModified: updates.lastModified ?? (record as KnowledgeBaseFileRecord).lastModified,
  };

  await withStore('readwrite', (store) => store.put(next));
}

export async function deleteWorkspaceKnowledgeBase(workspaceId: string): Promise<void> {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('workspaceId');
    const cursorRequest = index.openKeyCursor(IDBKeyRange.only(workspaceId));

    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      store.delete(cursor.primaryKey);
      cursor.continue();
    };

    cursorRequest.onerror = () => reject(cursorRequest.error || new Error('Failed to delete workspace files'));

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete workspace files'));
  });

  db.close();
}

export async function clearKnowledgeBaseStorage(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Failed to delete knowledge base storage'));
    request.onblocked = () => reject(new Error('Knowledge base storage deletion was blocked'));
  });
}
