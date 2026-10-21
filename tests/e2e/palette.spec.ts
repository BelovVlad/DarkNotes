import { test, expect, type Page } from '@playwright/test';

async function create(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Новая тетрадь', exact: true }).last().click();
  await page.getByPlaceholder('Например, квантовая механика').fill('Плавающая панель');
  await page.getByRole('dialog').getByRole('button', { name: 'Создать тетрадь', exact: true }).click();
  await expect(page.getByTestId('drawing-canvas')).toBeVisible();
}
async function objects(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('darknotes-v1'); r.onsuccess = () => resolve(r.result); });
    return new Promise<any[]>(resolve => { const r = db.transaction('documents').objectStore('documents').getAll(); r.onsuccess = () => { resolve(r.result[0].pages[0].objects); db.close(); }; });
  });
}

test('palette moves, collapses, remembers its position and stays reachable after rotation', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 }); await create(page);
  const palette = page.getByRole('toolbar', { name: 'Инструменты рисования' });
  const grip = page.getByRole('button', { name: 'Переместить панель', exact: true });
  const before = (await palette.boundingBox())!, handle = (await grip.boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 20); await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 90, handle.y + 280, { steps: 12 }); await page.mouse.up();
  const moved = (await palette.boundingBox())!; expect(moved.y).toBeGreaterThan(before.y + 200);
  expect(await objects(page)).toHaveLength(0);
  await page.getByRole('button', { name: 'Свернуть панель инструментов', exact: true }).click();
  await expect(palette).toHaveAttribute('data-collapsed', 'true');
  expect((await palette.boundingBox())!.width).toBeLessThan(240);
  await page.getByRole('button', { name: 'Развернуть панель', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ручка (P)', exact: true })).toBeVisible();
  await page.reload(); await expect(palette).toBeVisible();
  expect((await palette.boundingBox())!.y).toBeCloseTo(moved.y, 0);
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect.poll(async () => { const b = (await palette.boundingBox())!; return b.x >= 8 && b.x + b.width <= 812 && b.y + b.height < 1180; }).toBe(true);
  await grip.focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown');
  expect((await palette.boundingBox())!.y).toBe(74);
  await page.getByRole('button', { name: 'Режим письма', exact: true }).click();
  await expect(page.locator('.editor-header')).toBeHidden();
  await page.screenshot({ path: 'test-results/floating-palette-ipad.png' });
});

test('touch drag never draws ink and Pencil pressure/tilt survive reload', async ({ page, context }) => {
  await page.setViewportSize({ width: 820, height: 1180 }); await create(page);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const handle = (await page.getByRole('button', { name: 'Переместить панель', exact: true }).boundingBox())!;
  const x = handle.x + handle.width / 2, y = handle.y + 20;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + 250, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await objects(page)).toHaveLength(0);
  const box = (await page.getByTestId('drawing-canvas').boundingBox())!;
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x + 120, y: box.y + 180, button: 'left', buttons: 1, pointerType: 'pen', force: .2, tiltX: 15, tiltY: 20 });
  for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x + 120 + i * 8, y: box.y + 180 + i, button: 'left', buttons: 1, pointerType: 'pen', force: .2 + i * .05, tiltX: 15, tiltY: 20 });
  // A cancelled palm contact was never admitted to the pen's active pointer set.
  await page.getByTestId('drawing-canvas').dispatchEvent('pointercancel', { pointerId: 999, pointerType: 'touch', bubbles: true });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x + 216, y: box.y + 192, button: 'left', buttons: 0, pointerType: 'pen' });
  await expect.poll(async () => (await objects(page)).length).toBe(1);
  const ink = (await objects(page))[0];
  expect(ink.points.some((p: any) => p.p > .6 && p.tiltX === 15)).toBe(true);
  await page.reload(); await expect(page.getByTestId('drawing-canvas')).toBeVisible();
  expect((await objects(page))[0]).toEqual(ink);
});

test('file menu supports keyboard navigation and restores focus after dismissing', async ({ page }) => {
  await create(page); await page.getByRole('button', { name: 'В библиотеку', exact: true }).click();
  const trigger = page.getByRole('button', { name: 'Действия: Плавающая панель', exact: true });
  await trigger.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Переименовать', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown'); await expect(page.getByRole('menuitem', { name: 'Дублировать', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await expect(page.getByRole('menu')).toHaveCount(0);
});
