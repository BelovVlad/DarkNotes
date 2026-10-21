import { test, expect, type Page } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import fs from 'node:fs/promises';

async function current(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('darknotes-v1'); r.onsuccess = () => resolve(r.result); });
    return new Promise<any>(resolve => { const r = db.transaction('documents').objectStore('documents').get(location.hash.slice(5)); r.onsuccess = () => { resolve(r.result); db.close(); }; });
  });
}
async function draw(page: Page) {
  const box = (await page.getByTestId('drawing-canvas').boundingBox())!;
  await page.mouse.move(box.x + 130, box.y + 200); await page.mouse.down();
  await page.mouse.move(box.x + 230, box.y + 200, { steps: 12 }); await page.mouse.up();
  await expect.poll(async () => (await current(page)).pages[0].objects.length).toBe(1);
}

test('WebKit tablet: ink, undo/redo, palette, rotation and offline persistence', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.getByRole('button', { name: 'Новая тетрадь', exact: true }).last().click();
  await page.getByPlaceholder('Например, квантовая механика').fill('WebKit · конспект');
  await page.getByRole('dialog').getByRole('button', { name: 'Создать тетрадь', exact: true }).click();
  await expect(page.getByTestId('drawing-canvas')).toBeVisible(); await draw(page);
  const saved = (await current(page)).pages[0].objects;
  await page.getByRole('button', { name: 'Отменить (Ctrl+Z)', exact: true }).click();
  await expect.poll(async () => (await current(page)).pages[0].objects.length).toBe(0);
  await page.getByRole('button', { name: 'Повторить (Ctrl+Shift+Z)', exact: true }).click();
  await expect.poll(async () => (await current(page)).pages[0].objects).toEqual(saved);
  await page.getByRole('button', { name: 'Свернуть панель инструментов', exact: true }).tap();
  await expect(page.getByRole('toolbar')).toHaveAttribute('data-collapsed', 'true');
  await page.getByRole('button', { name: 'Развернуть панель', exact: true }).tap();
  await page.getByRole('button', { name: 'Переместить панель', exact: true }).hover();
  const handle = (await page.getByRole('button', { name: 'Переместить панель', exact: true }).boundingBox())!;
  await page.mouse.move(handle.x + 12, handle.y + 20); await page.mouse.down();
  await page.mouse.move(12,400, { steps: 8 }); await page.mouse.up();
  await expect(page.getByRole('toolbar')).toHaveAttribute('data-edge','left');
  await page.setViewportSize({ width: 1180, height: 820 });
  const bounds = (await page.getByRole('toolbar').boundingBox())!; expect(bounds.x).toBeGreaterThanOrEqual(8); expect(bounds.x + bounds.width).toBeLessThanOrEqual(1172);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; }); await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true); await page.reload(); await expect(page.getByTestId('drawing-canvas')).toBeVisible();
  expect((await current(page)).pages[0].objects).toEqual(saved);
  await page.getByRole('button',{name:'Параметры пера',exact:true}).click();
  const palette=(await page.getByRole('toolbar').boundingBox())!,panel=(await page.getByRole('region',{name:'Параметры инструмента',exact:true}).boundingBox())!;
  expect(panel.x).toBeGreaterThanOrEqual(palette.x+palette.width+8);
  await page.screenshot({ path: 'test-results/webkit-tablet.png' }); expect(errors).toEqual([]);
});

test('WebKit tablet: PDF annotations, searchable export and editable project backup', async ({ page }) => {
  const pdf = await PDFDocument.create(), source = pdf.addPage([600, 800]), font = await pdf.embedFont(StandardFonts.Helvetica);
  source.drawText('WebKit physics lecture', { x: 50, y: 720, font, size: 20 });
  await page.goto('/'); await page.locator('input[type=file]').setInputFiles({ name: 'webkit.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await expect(page.getByTestId('drawing-canvas')).toBeVisible(); await draw(page);
  await page.getByRole('button', { name: 'Показать страницы', exact: true }).click();
  await page.getByRole('textbox', { name: 'Поиск по тексту PDF' }).fill('physics'); await expect(page.getByRole('button', { name: /Стр. 1/ })).toBeVisible();
  await page.getByRole('button', { name: 'Экспорт', exact: true }).click();
  let download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Редактируемый проект .darknotes', exact: true }).click();
  const archive = JSON.parse(await fs.readFile((await (await download).path())!, 'utf8'));
  expect(archive.assets).toHaveLength(1); expect(archive.documents[0].pages[0].objects).toHaveLength(1);
  await page.getByRole('button', { name: 'Экспорт', exact: true }).click(); await page.getByRole('button', { name: 'Экспортировать PDF', exact: true }).click();
  await page.getByRole('button', { name: /Белый для печати/ }).click(); download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать PDF', exact: true }).click();
  const bytes = await fs.readFile((await (await download).path())!); expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  await page.getByRole('button', { name: 'В библиотеку', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'export.pdf', mimeType: 'application/pdf', buffer: bytes });
  await expect(page.getByTestId('drawing-canvas')).toBeVisible(); await page.getByRole('button', { name: 'Показать страницы', exact: true }).click();
  await page.getByRole('textbox', { name: 'Поиск по тексту PDF' }).fill('physics'); await expect(page.getByRole('button', { name: /Стр. 1/ })).toBeVisible();
});


test('WebKit tablet: pull beyond the last page creates a blank continuation',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Новая тетрадь',exact:true}).last().click();
 await page.getByPlaceholder('Например, квантовая механика').fill('Продолжение');await page.getByRole('dialog').getByRole('button',{name:'Создать тетрадь',exact:true}).click();
 await expect(page.getByTestId('drawing-canvas')).toBeVisible();await page.getByRole('button',{name:'Перемещение (V)',exact:true}).click();
 const drag=async()=>{const b=(await page.getByTestId('drawing-canvas').boundingBox())!;const y=Math.max(350,Math.min(700,b.y+400));await page.mouse.move(400,y);await page.mouse.down();await page.mouse.move(400,y-250,{steps:8});await page.mouse.up();};
 await drag();await expect.poll(async()=>(await current(page)).pages.length).toBe(2);
 await expect(page.getByRole('button',{name:'Страницы и масштаб',exact:true})).toHaveText('2/2');
 expect((await current(page)).pages[1].objects).toEqual([]);await page.screenshot({path:'test-results/webkit-continuation.png'});
});

test('WebKit tablet: pen hover rejects resting palms without native selection',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Новая тетрадь',exact:true}).last().click();
 await page.getByPlaceholder('Например, квантовая механика').fill('Защита ладони');await page.getByRole('dialog').getByRole('button',{name:'Создать тетрадь',exact:true}).click();
 await expect(page.getByTestId('drawing-canvas')).toBeVisible();
 const result=await page.getByTestId('page-viewport').evaluate(async view=>{
  const canvas=view.querySelector('.active-layer')!;
  const initial={top:view.scrollTop,width:canvas.getBoundingClientRect().width};
  canvas.dispatchEvent(new PointerEvent('pointermove',{pointerType:'pen',pointerId:5,clientX:300,clientY:300,bubbles:true}));
  const touch=(type:string,y:number)=>canvas.dispatchEvent(new PointerEvent(type,{pointerType:'touch',pointerId:8,clientX:400,clientY:y,width:10,height:10,bubbles:true,cancelable:true}));
  const down=touch('pointerdown',500);
  await new Promise(resolve=>setTimeout(resolve,850));
  const move=touch('pointermove',200),up=touch('pointerup',200);
  const selection=view.dispatchEvent(new Event('selectstart',{bubbles:true,cancelable:true}));
  const text=document.createTextNode('selection target');view.append(text);
  const textSelection=text.dispatchEvent(new Event('selectstart',{bubbles:true,cancelable:true}));text.remove();
  return {initial,final:{top:view.scrollTop,width:canvas.getBoundingClientRect().width},down,move,up,selection,textSelection};
 });
 expect(result.final).toEqual(result.initial);expect([result.down,result.move,result.up,result.selection,result.textSelection]).toEqual([false,false,false,false,false]);
 expect((await current(page)).pages[0].objects).toEqual([]);
});
