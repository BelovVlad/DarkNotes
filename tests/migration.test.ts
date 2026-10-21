import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { newDocument, defaultSettings } from '../src/model';
import { database, getAsset, loadLibrary, saveDocument } from '../src/storage';

it('upgrades the original native IndexedDB v1 in place, preserving notes, folders, preferences and PDF blobs', async () => {
  const doc = newDocument('Существующая лекция', { pdfAsset: 'source', type: 'pdf', folderId: 'physics' });
  const source = new Blob(['%PDF-1.7\nlegacy PDF bytes'], { type: 'application/pdf' });
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('darknotes-v1', 1);
    request.onupgradeneeded = () => { for (const name of ['documents', 'previous', 'folders', 'assets', 'settings']) request.result.createObjectStore(name, { keyPath: 'id' }); };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const native = request.result, tx = native.transaction(['documents', 'previous', 'folders', 'assets', 'settings'], 'readwrite');
      tx.objectStore('documents').put(doc);
      tx.objectStore('previous').put({ ...doc, title: 'Предыдущая версия' });
      tx.objectStore('folders').put({ id: 'physics', title: 'Физика', parentId: null, color: '#aabbcc' });
      tx.objectStore('assets').put({ id: 'source', blob: source });
      tx.objectStore('settings').put({ id: 'main', value: { ...defaultSettings, penOnly: true } });
      tx.oncomplete = () => { native.close(); resolve(); }; tx.onerror = () => reject(tx.error);
    };
  });
  const migrated = await database(), library = await loadLibrary();
  expect(migrated.version).toBe(10);
  expect(library.documents).toEqual([doc]);
  expect(library.folders[0].id).toBe('physics');
  expect(library.settings.penOnly).toBe(true);
  expect(await (await getAsset('source')).text()).toBe(await source.text());
  await saveDocument({ ...doc, title: 'После обновления' });
  expect((await loadLibrary()).documents[0].title).toBe('После обновления');
});
