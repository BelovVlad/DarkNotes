import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { blankPage, defaultSettings, newDocument } from '../src/model';
import { backup, database, flushSaves, getAsset, loadLibrary, putAsset, purgeDocument, restoreBackup, saveDocument, saveFolders, saveSettings, validDocument } from '../src/storage';
beforeEach(async()=>{await flushSaves().catch(()=>{});const db=await database();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['documents','previous','folders','settings','assets'],'readwrite');for(const s of ['documents','previous','folders','settings','assets'])tx.objectStore(s).clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});});
describe('transactional local storage',()=>{
 it('preserves strokes and nested folders across a fresh library load',async()=>{const doc=newDocument('Формулы',{folderId:'nested',pages:[blankPage({objects:[{id:'s',kind:'stroke',points:[{x:10,y:20,p:.6,t:0,tiltX:20}],color:'#000',width:2,opacity:1,pen:'fountain',highlighter:false}]})]});await saveFolders([{id:'root',title:'Физика',parentId:null,color:'#888'},{id:'nested',title:'Лекции',parentId:'root',color:'#888'}]);await saveDocument(doc);const result=await loadLibrary();expect(result.documents[0]).toEqual(doc);expect(result.folders.find(f=>f.id==='nested')?.parentId).toBe('root');});
 it('serializes rapid writes and keeps the previous good version',async()=>{const doc=newDocument('v1');const p1=saveDocument(doc),p2=saveDocument({...doc,title:'v2'}),p3=saveDocument({...doc,title:'v3'});await Promise.all([p1,p2,p3]);const db=await database();const previous=await new Promise<any>(resolve=>{const r=db.transaction('previous').objectStore('previous').get(doc.id);r.onsuccess=()=>resolve(r.result);});expect((await loadLibrary()).documents[0].title).toBe('v3');expect(previous.title).toBe('v2');});
 it('recovers a corrupted document from its last good version',async()=>{const doc=newDocument('correct');await saveDocument(doc);await saveDocument({...doc,title:'latest'});const db=await database();await new Promise<void>(resolve=>{const tx=db.transaction('documents','readwrite');tx.objectStore('documents').put({id:doc.id,pages:null});tx.oncomplete=()=>resolve();});const result=await loadLibrary();expect(result.documents[0].title).toBe('correct');expect(result.recovered).toEqual([doc.id]);});
 it('rejects invalid writes without overwriting valid data',async()=>{const doc=newDocument('safe');await saveDocument(doc);await expect(saveDocument({...doc,pages:[]})).rejects.toThrow();expect((await loadLibrary()).documents[0].title).toBe('safe');expect(validDocument({...doc,pages:[{...doc.pages[0],width:NaN}]})).toBe(false);});
 it('restores a backup atomically without losing unrelated documents',async()=>{const existing=newDocument('existing');await saveDocument(existing);const imported=newDocument('imported'),blob=await backup([imported],[],defaultSettings);const count=await restoreBackup(new File([blob],'copy.darknotes'));expect(count).toBe(1);expect((await loadLibrary()).documents).toHaveLength(2);});
 it('rejects an invalid archive before changing the library',async()=>{const doc=newDocument('keep');await saveDocument(doc);await expect(restoreBackup(new File([JSON.stringify({format:'darknotes',version:1,documents:[{id:'broken'}],folders:[],assets:[]})],'bad.darknotes'))).rejects.toThrow();expect((await loadLibrary()).documents).toEqual([doc]);});
 it('rejects cyclic folders in backups',async()=>{const content={format:'darknotes',version:1,documents:[],assets:[],folders:[{id:'a',parentId:'b',title:'a'},{id:'b',parentId:'a',title:'b'}]};await expect(restoreBackup(new File([JSON.stringify(content)],'bad.darknotes'))).rejects.toThrow('Цикл');});
 it('keeps trash recoverable, and only purges on explicit deletion',async()=>{const doc=newDocument('trash',{deleted:Date.now()});await saveDocument(doc);expect((await loadLibrary()).documents).toHaveLength(1);await saveDocument({...doc,deleted:null});expect((await loadLibrary()).documents[0].deleted).toBeNull();await purgeDocument(doc);expect((await loadLibrary()).documents).toHaveLength(0);});
 it('persists editor preferences separately from documents',async()=>{await saveSettings({...defaultSettings,penOnly:true,theme:'light'});expect((await loadLibrary()).settings).toMatchObject({penOnly:true,theme:'light'});});
 it('restores preferences and sanitizes malformed settings',async()=>{const blob=await backup([],[],{...defaultSettings,penOnly:true,theme:'light'});await restoreBackup(new File([blob],'prefs.darknotes'));expect((await loadLibrary()).settings.penOnly).toBe(true);});
 it('retains shared PDF blobs until the last document is permanently removed',async()=>{
  const source=new Blob(['%PDF-1.7\nshared'],{type:'application/pdf'});
  await putAsset('shared',source);
  const a=newDocument('original',{pdfAsset:'shared'}),b=newDocument('duplicate',{pdfAsset:'shared',deleted:Date.now()});
  await saveDocument(a);await saveDocument(b);await purgeDocument(a);
  expect(await(await getAsset('shared')).text()).toBe(await source.text());
  await purgeDocument(b);await expect(getAsset('shared')).rejects.toThrow('не найден');
 });
 it('rejects fake PDF data without partially importing documents or folders',async()=>{
  const existing=newDocument('safe');await saveDocument(existing);
  const imported=newDocument('bad',{pdfAsset:'fake'});
  const content={format:'darknotes',version:1,documents:[imported],folders:[],assets:[{id:'fake',data:'data:application/pdf;base64,aGVsbG8='}]};
  await expect(restoreBackup(new File([JSON.stringify(content)],'bad.darknotes'))).rejects.toThrow('Повреждён PDF');
  expect((await loadLibrary()).documents).toEqual([existing]);
 });
 it('keeps PDF bytes referenced only by another document recovery version',async()=>{
  await putAsset('old',new Blob(['%PDF-1.7\nold']));await putAsset('new',new Blob(['%PDF-1.7\nnew']));
  const changing=newDocument('changing',{pdfAsset:'old'}),removed=newDocument('removed',{pdfAsset:'old'});
  await saveDocument(changing);await saveDocument({...changing,pdfAsset:'new'});await saveDocument(removed);await purgeDocument(removed);
  expect(await(await getAsset('old')).text()).toContain('old');
 });

});
