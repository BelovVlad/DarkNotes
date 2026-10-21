import { test, expect, type Page } from '@playwright/test';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import fs from 'node:fs/promises';
test.use({hasTouch:true});

async function create(page:Page) {await page.goto('/');await page.getByRole('button',{name:'Новая тетрадь',exact:true}).last().click();await expect(page.locator('.notebook-preview')).toHaveCount(0);await page.getByPlaceholder('Например, квантовая механика').fill('Конспект');await page.screenshot({path:'test-results/new-notebook-clean.png'});await page.getByRole('dialog').getByRole('button',{name:'Создать тетрадь',exact:true}).click();await expect(page.getByTestId('drawing-canvas')).toBeVisible();}
async function current(page:Page) {return page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('darknotes-v1');r.onsuccess=()=>resolve(r.result);});return new Promise<any>(resolve=>{const r=db.transaction('documents').objectStore('documents').get(location.hash.slice(5));r.onsuccess=()=>{resolve(r.result);db.close();};});});}
async function draw(page:Page) {const b=(await page.getByTestId('drawing-canvas').boundingBox())!;await page.mouse.move(b.x+140,b.y+180);await page.mouse.down();await page.mouse.move(b.x+260,b.y+180,{steps:12});await page.mouse.up();}
async function pixel(page:Page,selector:string,x=8,y=8){return page.locator(selector).evaluate((canvas:HTMLCanvasElement,{x,y})=>Array.from(canvas.getContext('2d')!.getImageData(x,y,1,1).data),{x,y});}
async function exported(page:Page,theme:'light'|'dark') {await page.getByRole('button',{name:'Экспорт',exact:true}).click();await page.getByRole('button',{name:'Экспортировать PDF',exact:true}).click();await page.getByRole('button',{name:theme==='light'?'Белый для печати':'Тёмный DarkNotes',exact:false}).click();await page.screenshot({path:`test-results/export-${theme}-dialog.png`});const download=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать PDF',exact:true}).click();return fs.readFile((await(await download).path())!);}

for(const size of [{width:820,height:1180},{width:1180,height:820}])test(`tablet ${size.width}: quiet editor, immediate stroke persistence, reversible theme, focus and resize`,async({page})=>{
 await page.setViewportSize(size);await create(page);await expect(page.locator('.pages-sidebar')).toHaveCount(0);
 const viewport=(await page.getByTestId('page-viewport').boundingBox())!;expect(viewport.height).toBeGreaterThan(size.height-145);
 await expect.poll(()=>pixel(page,'.paper-layer')).toEqual([14,21,28,255]);
 expect(await page.locator('.editor-toolbar').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await draw(page);await expect.poll(async()=>(await current(page)).pages[0].objects.length,{timeout:2000}).toBe(1);const original=(await current(page)).pages[0].objects;
 await page.screenshot({path:`test-results/tablet-${size.width}-dark.png`});
 await page.getByRole('button',{name:'Светлая бумага',exact:true}).click();await expect.poll(()=>pixel(page,'.paper-layer')).toEqual([255,255,255,255]);
 await expect(page.locator('.page-frame')).toHaveAttribute('data-paper-theme','light');expect((await current(page)).pages[0].objects).toEqual(original);
 await page.getByRole('button',{name:'Параметры пера',exact:true}).click();await expect(page.getByRole('button',{name:'Основной',exact:true})).toHaveCSS('background-color','rgb(37, 43, 40)');await page.getByRole('button',{name:'Закрыть параметры',exact:true}).click();
 await page.screenshot({path:`test-results/tablet-${size.width}-light.png`});
 await page.getByRole('button',{name:'Режим письма',exact:true}).click();expect((await page.getByTestId('page-viewport').boundingBox())!.height).toBeGreaterThan(size.height-65);
 await page.setViewportSize({width:size.height,height:size.width});await expect.poll(()=>page.getByTestId('drawing-canvas').boundingBox().then(b=>b!.width)).toBeGreaterThan(Math.min(size.height-30,1190));
 await page.getByRole('button',{name:'Выйти из режима письма',exact:true}).click();await page.reload();expect((await current(page)).pages[0].objects).toEqual(original);await expect(page.locator('.pages-sidebar')).toHaveCount(0);
});

test('both PDF themes contain vector ink and searchable Cyrillic text',async({page})=>{
 await create(page);await draw(page);await page.getByRole('button',{name:'Фигуры и вставка',exact:true}).click();await page.getByRole('button',{name:'Текстовый блок (T)',exact:true}).click();const b=(await page.getByTestId('drawing-canvas').boundingBox())!;await page.mouse.click(b.x+80,b.y+80);await page.getByRole('dialog').locator('textarea').fill('Лекция по физике');await page.getByRole('button',{name:'Готово',exact:true}).click();
 for(const theme of ['dark','light'] as const){const bytes=await exported(page,theme),pdf=await PDFDocument.load(bytes);expect(pdf.getPageCount()).toBe(1);expect(bytes.length).toBeLessThan(70000);await fs.writeFile(`test-results/notebook-${theme}.pdf`,bytes);}
 const bytes=await exported(page,'light');await page.getByRole('button',{name:'В библиотеку',exact:true}).click();await expect(page.getByRole('button',{name:'Импорт PDF',exact:true})).toBeVisible();await page.locator('input[type=file]').setInputFiles({name:'vector.pdf',mimeType:'application/pdf',buffer:bytes});await expect(page.getByTestId('drawing-canvas')).toBeVisible();await page.getByRole('button',{name:'Показать страницы',exact:true}).click();await page.getByRole('textbox',{name:'Поиск по тексту PDF'}).fill('Лекция по физике');await expect(page.getByRole('button',{name:/Стр. 1/})).toBeVisible();
});

test('white PDF export preserves source text, crop and intrinsic rotation',async({page})=>{
 const source=await PDFDocument.create(),p=source.addPage([640,900]),font=await source.embedFont(StandardFonts.Helvetica);p.drawText('Rotated source lecture',{x:80,y:700,size:22,font});p.setCropBox(20,40,580,800);p.setRotation(degrees(90));
 await page.goto('/');await page.locator('input[type=file]').setInputFiles({name:'rotated.pdf',mimeType:'application/pdf',buffer:Buffer.from(await source.save())});await expect(page.getByTestId('drawing-canvas')).toBeVisible();await draw(page);const bytes=await exported(page,'light'),pdf=await PDFDocument.load(bytes);expect(pdf.getPage(0).getSize()).toEqual({width:800,height:580});
 await page.getByRole('button',{name:'В библиотеку',exact:true}).click();await expect(page.getByRole('button',{name:'Импорт PDF',exact:true})).toBeVisible();await page.locator('input[type=file]').setInputFiles({name:'preserved.pdf',mimeType:'application/pdf',buffer:bytes});await expect(page.getByTestId('drawing-canvas')).toBeVisible();await page.getByRole('button',{name:'Показать страницы',exact:true}).click();await page.getByRole('textbox',{name:'Поиск по тексту PDF'}).fill('Rotated source lecture');await expect(page.getByRole('button',{name:/Стр. 1/})).toBeVisible();
});

test('ordinary eraser sweeps through a stroke, object eraser removes it, both undo',async({page})=>{
 await create(page);await draw(page);await expect.poll(async()=>(await current(page)).pages[0].objects.length).toBe(1);
 await page.getByRole('button',{name:'Ластик (E)',exact:true}).click();await expect(page.getByRole('button',{name:'Ластик (E)',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('region',{name:'Параметры инструмента',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Ластик (E)',exact:true}).click();await expect(page.getByRole('button',{name:'Частичный ластик',exact:true})).toHaveAttribute('aria-pressed','true');
 const b=(await page.getByTestId('drawing-canvas').boundingBox())!;await page.mouse.move(b.x+200,b.y+100);await page.mouse.down();await page.mouse.move(b.x+200,b.y+260);await page.mouse.up();await expect.poll(async()=>(await current(page)).pages[0].objects.length).toBe(2);
 await page.getByRole('button',{name:'Отменить (Ctrl+Z)',exact:true}).click();await expect.poll(async()=>(await current(page)).pages[0].objects.length).toBe(1);
 await page.getByRole('button',{name:'Ластик (E)',exact:true}).click();await page.getByRole('button',{name:'Объектный ластик',exact:true}).click();await page.mouse.click(b.x+200,b.y+180);await expect.poll(async()=>(await current(page)).pages[0].objects.length).toBe(0);
 await page.getByRole('button',{name:'Отменить (Ctrl+Z)',exact:true}).click();await expect.poll(async()=>(await current(page)).pages[0].objects.length).toBe(1);
});

test('failed stroke save stays visible and retries the in-memory stroke',async({page})=>{
 await create(page);await expect(page.locator('[data-save-state=saved]')).toBeVisible();
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;(window as any).restoreWrites=()=>{IDBObjectStore.prototype.put=original;};IDBObjectStore.prototype.put=function(value:any,key?:IDBValidKey){if(this.name==='documents')throw new DOMException('Test quota exhausted','QuotaExceededError');return key===undefined?original.call(this,value):original.call(this,value,key);};});
 await draw(page);await expect(page.getByRole('alert')).toContainText('Не удалось сохранить');await expect(page.getByText('Ошибка сохранения',{exact:true})).toBeVisible();expect((await current(page)).pages[0].objects).toHaveLength(0);
 expect(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;})).toBe(true);
 await page.evaluate(()=>(window as any).restoreWrites());await page.getByRole('button',{name:'Повторить сохранение',exact:true}).click();await expect(page.locator('[data-save-state=saved]')).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0);expect((await current(page)).pages[0].objects).toHaveLength(1);
});
