import Dexie, { type Table } from 'dexie';
import { defaultSettings, type Folder, type NoteDocument, type Settings } from './model';

const db = new Dexie('darknotes-v1', { chromeTransactionDurability: 'strict', cache: 'disabled' });
// Dexie uses native IDB version / 10. Adopt the original native v1 without
// replacing stores, then add indexes in native v10. Existing notes and PDF blobs stay in place.
db.version(0.1).stores({ documents: 'id', previous: 'id', folders: 'id', assets: 'id', settings: 'id' });
db.version(1).stores({ documents: 'id,folderId,updated', previous: 'id', folders: 'id,parentId', assets: 'id', settings: 'id' });
const documents: Table<NoteDocument, string> = db.table('documents');
const previous: Table<NoteDocument, string> = db.table('previous');
const folders: Table<Folder, string> = db.table('folders');
// Store newly imported bytes directly: file-backed Blob handles can fail to
// serialize in WebKit. Continue reading Blob records written by earlier builds.
const assets: Table<{ id: string; blob?: Blob; bytes?: ArrayBuffer }, string> = db.table('assets');
const preferences: Table<{ id: string; value: Settings }, string> = db.table('settings');
export async function database(): Promise<IDBDatabase> { await db.open(); return db.backendDB(); }

export function validDocument(value: unknown): value is NoteDocument {
 if(!value||typeof value!=='object')return false;const d=value as NoteDocument;
 const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n),color=(c:unknown)=>typeof c==='string'&&/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(c);
 return typeof d.id==='string'&&typeof d.title==='string'&&['notebook','pdf'].includes(d.type)&&finite(d.created)&&finite(d.updated)&&Array.isArray(d.pages)&&d.pages.length>0&&d.pages.every(p=>p&&typeof p.id==='string'&&finite(p.width)&&p.width>0&&p.width<=10000&&finite(p.height)&&p.height>0&&p.height<=10000&&[0,90,180,270].includes(p.rotation)&&['blank','grid','ruled','dots'].includes(p.paper)&&color(p.paperColor)&&Array.isArray(p.objects)&&p.objects.every(o=>o&&typeof o.id==='string'&&(
  o.kind==='stroke'?color(o.color)&&finite(o.width)&&o.width>0&&finite(o.opacity)&&o.opacity>=0&&o.opacity<=1&&['regular','ballpoint','fountain'].includes(o.pen)&&Array.isArray(o.points)&&o.points.length>0&&o.points.every(q=>finite(q.x)&&finite(q.y)&&finite(q.p)&&finite(q.t)):
  o.kind==='text'?finite(o.x)&&finite(o.y)&&finite(o.width)&&finite(o.height)&&typeof o.text==='string'&&finite(o.size)&&o.size>0&&color(o.color):
  o.kind==='image'?finite(o.x)&&finite(o.y)&&finite(o.width)&&o.width>0&&finite(o.height)&&o.height>0&&typeof o.data==='string'&&/^data:image\/(png|jpeg|webp|gif|avif|bmp);base64,/i.test(o.data):false)));
}
export function normalizeSettings(raw:unknown):Settings {const s=raw&&typeof raw==='object'?raw as Partial<Settings>:{};const result=structuredClone(defaultSettings);for(const key of ['compact','penOnly','pressure','circleLasso','scribbleErase','shapeHold','twoFingerUndo','doubleTapZoom'] as const)if(typeof s[key]==='boolean')result[key]=s[key];if(['dark','light','system'].includes(s.theme||''))result.theme=s.theme!;if(typeof s.accent==='string'&&/^#[a-f0-9]{6}$/i.test(s.accent))result.accent=s.accent;if(Number.isFinite(s.smoothing))result.smoothing=Math.max(0,Math.min(1,s.smoothing!));if(Number.isFinite(s.holdMs))result.holdMs=Math.max(300,Math.min(2000,s.holdMs!));if(s.toolbar==='top'||s.toolbar==='bottom')result.toolbar=s.toolbar;if(s.scroll==='continuous'||s.scroll==='single'&&s.pageFlowVersion===1)result.scroll=s.scroll;if(['pen','highlighter','lasso','hand'].includes(s.defaultTool||''))result.defaultTool=s.defaultTool!;if(Array.isArray(s.presets)&&s.presets.length&&s.presets.every(p=>p&&/^#[a-f0-9]{6}$/i.test(p.color)&&Number.isFinite(p.width)&&p.width>=1&&p.width<=14&&Number.isFinite(p.opacity)&&p.opacity>0&&p.opacity<=1&&['regular','ballpoint','fountain'].includes(p.pen)))result.presets=s.presets.slice(0,8);return result;}
export async function loadLibrary() {
  return db.transaction('r', [documents, folders, preferences, previous], async () => {
    const [docs, storedFolders, saved, old] = await Promise.all([
      documents.toArray(), folders.toArray(), preferences.get('main'), previous.toArray(),
    ]);
    const recovered: string[] = [];
    const valid = docs.flatMap((value: unknown) => {
      if (validDocument(value)) return [value];
      const id = (value as { id?: string } | null)?.id;
      const fallback = old.find(item => item.id === id && validDocument(item));
      if (fallback) { recovered.push(fallback.id); return [fallback]; }
      return [];
    });
    return { documents: valid, folders: storedFolders, settings: normalizeSettings(saved?.value), recovered };
  });
}
let queue: Promise<void> = Promise.resolve();
export function saveDocument(doc: NoteDocument) {
  if (!validDocument(doc)) return Promise.reject(new Error('Некорректный документ: сохранение остановлено'));
  const value = structuredClone(doc);
  const operation = queue.catch(() => {}).then(() => db.transaction('rw', [documents, previous], async () => {
    const old = await documents.get(value.id);
    if (validDocument(old)) await previous.put(old);
    await documents.put(value);
  }));
  queue = operation;
  return operation;
}
export async function saveFolders(value: Folder[]) {
  validateFolderTree(value);
  await db.transaction('rw', folders, async () => { await folders.clear(); if (value.length) await folders.bulkPut(value); });
}
export async function saveSettings(value: Settings) { await preferences.put({ id: 'main', value: normalizeSettings(value) }); }
export async function putAsset(id: string, blob: Blob) { await assets.put({ id, bytes: await blob.arrayBuffer() }); }
export async function getAsset(id: string): Promise<Blob> {
  const result = await assets.get(id);
  if (result?.bytes) return new Blob([result.bytes], { type: 'application/pdf' });
  if (result?.blob) return result.blob;
  throw new Error('Исходный PDF не найден. Восстановите документ из резервной копии.');
}
export async function purgeDocument(doc: NoteDocument) {
  await queue.catch(() => {});
  // Duplicated PDF documents share the original blob. Reclaim it only after the
  // last referencing document (including recoverable trash) has been removed.
  await db.transaction('rw', [documents, previous, assets], async () => {
    await documents.delete(doc.id); await previous.delete(doc.id);
    if (doc.pdfAsset) {
      const [current, recovery] = await Promise.all([documents.toArray(), previous.toArray()]);
      if (![...current, ...recovery].some(item => item.pdfAsset === doc.pdfAsset)) await assets.delete(doc.pdfAsset);
    }
  });
}
export async function flushSaves() { await queue; }
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
const blobToData = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob);
});
export async function backup(docs: NoteDocument[], storedFolders: Folder[], settings: Settings) {
  await queue.catch(() => {});
  const ids = [...new Set(docs.flatMap(doc => doc.pdfAsset ? [doc.pdfAsset] : []))];
  const storedAssets = await Promise.all(ids.map(async id => ({ id, data: await blobToData((await getAsset(id)).slice(0, undefined, 'application/pdf')) })));
  return new Blob([JSON.stringify({ format: 'darknotes', version: 1, created: new Date().toISOString(), documents: docs, folders: storedFolders, settings, assets: storedAssets })], { type: 'application/json' });
}
function validateFolderTree(folders: Folder[]) {const map=new Map(folders.map(f=>[f.id,f]));if(map.size!==folders.length)throw new Error('Повторяющиеся папки');for(const f of folders){const seen=new Set<string>();let current:Folder|undefined=f;while(current){if(seen.has(current.id))throw new Error('Цикл в структуре папок');seen.add(current.id);if(current.parentId&&!map.has(current.parentId))throw new Error('Родительская папка не найдена');current=current.parentId?map.get(current.parentId):undefined;}}}
// Validate and decode before opening the single atomic write transaction.
export async function restoreBackup(file: File): Promise<number> {
  if (file.size > 500 * 1024 * 1024) throw new Error('Резервная копия превышает 500 МБ');
  const data = JSON.parse(await file.text());
  if (data?.format !== 'darknotes' || data.version !== 1 || !Array.isArray(data.documents) || !data.documents.every(validDocument) || !Array.isArray(data.folders) || !Array.isArray(data.assets)) throw new Error('Это не резервная копия DarkNotes версии 1');
  if (!data.folders.every((folder: Folder) => folder && typeof folder.id === 'string' && typeof folder.title === 'string' && (folder.parentId === null || typeof folder.parentId === 'string'))) throw new Error('Повреждён список папок');
  validateFolderTree(data.folders);
  if (new Set(data.documents.map((doc: NoteDocument) => doc.id)).size !== data.documents.length) throw new Error('Повторяющиеся документы');
  const decoded = data.assets.map((asset: { id: string; data: string }) => {
    if (!asset || typeof asset.id !== 'string' || typeof asset.data !== 'string' || !/^data:(?:application\/(?:pdf|octet-stream))?;base64,/i.test(asset.data)) throw new Error('Повреждён PDF в копии');
    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(atob(asset.data.slice(asset.data.indexOf(',') + 1)), char => char.charCodeAt(0)); }
    catch { throw new Error('Повреждён PDF в копии'); }
    if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes('%PDF-')) throw new Error('Повреждён PDF в копии');
    return { id: asset.id, bytes: bytes.buffer as ArrayBuffer };
  });
  const available = new Set(decoded.map((asset: { id: string }) => asset.id));
  if (available.size !== decoded.length) throw new Error('Повторяющиеся исходные PDF');
  for (const doc of data.documents as NoteDocument[]) if (doc.pdfAsset && !available.has(doc.pdfAsset)) throw new Error('В копии отсутствует исходный PDF');
  await flushSaves();
  await db.transaction('rw', [documents, previous, folders, assets, preferences], async () => {
    // Archives merge with this library. Validate the combined tree as well: a
    // valid imported tree can otherwise introduce a cycle with existing folders.
    const merged = new Map((await folders.toArray()).map(folder => [folder.id, folder]));
    for (const folder of data.folders as Folder[]) merged.set(folder.id, folder);
    validateFolderTree([...merged.values()]);
    for (const doc of data.documents as NoteDocument[]) {
      const old = await documents.get(doc.id);
      if (validDocument(old)) await previous.put(old);
      await documents.put(doc);
    }
    if (data.folders.length) await folders.bulkPut(data.folders);
    if (decoded.length) await assets.bulkPut(decoded);
    if (data.settings) await preferences.put({ id: 'main', value: normalizeSettings(data.settings) });
  });
  return data.documents.length;
}
export { blobToData };
