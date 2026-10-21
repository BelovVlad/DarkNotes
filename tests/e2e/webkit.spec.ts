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
  const handle = (await page.getByRole('button', { name: 'Переместить панель', exact: true }).boundingBox())!;
  await page.mouse.move(handle.x + 12, handle.y + 20); await page.mouse.down();
  await page.mouse.move(handle.x + 12, handle.y + 240, { steps: 8 }); await page.mouse.up();
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
