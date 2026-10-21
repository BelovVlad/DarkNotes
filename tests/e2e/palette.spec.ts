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

async function dockAt(page: Page, x: number, y: number) {
  const handle = (await page.getByRole('button', { name: 'Переместить панель', exact: true }).boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
  await page.mouse.move(x, y, { steps: 12 }); await page.mouse.up();
}

test('palette docks at every edge, turns vertically and keeps settings attached', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 }); await create(page);
  const palette = page.getByRole('toolbar', { name: 'Инструменты рисования' });
  const cases = [{edge:'left',x:12,y:400},{edge:'right',x:1168,y:400},{edge:'bottom',x:590,y:770},{edge:'top',x:590,y:60}];
  for (const target of cases) {
    await dockAt(page,target.x,target.y); await expect(palette).toHaveAttribute('data-edge',target.edge);
    const vertical=target.edge==='left'||target.edge==='right'; await expect(palette).toHaveAttribute('aria-orientation',vertical?'vertical':'horizontal');
    await page.getByRole('button',{name:'Параметры пера',exact:true}).click();
    const panel=page.getByRole('region',{name:'Параметры инструмента',exact:true});await expect(panel).toBeVisible();
    await expect.poll(async()=>{
      const p=(await panel.boundingBox())!,t=(await palette.boundingBox())!;
      if(target.edge==='top')return Math.abs(p.y-t.y-t.height-10)<2;
      if(target.edge==='bottom')return Math.abs(t.y-p.y-p.height-10)<2;
      if(target.edge==='left')return Math.abs(p.x-t.x-t.width-10)<2;
      return Math.abs(t.x-p.x-p.width-10)<2;
    }).toBe(true);
    await expect.poll(async()=>{const p=(await panel.boundingBox())!;return p.x>=12&&p.y>=56&&p.x+p.width<=1168&&p.y+p.height<=808;}).toBe(true);
    if(target.edge==='right')await page.screenshot({path:'test-results/docked-palette-right.png'});
    await page.getByRole('button',{name:'Закрыть параметры',exact:true}).click();
  }
  expect(await objects(page)).toHaveLength(0);
});

test('docked palette collapses, persists, rotates and supports keyboard docking', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 }); await create(page);
  const palette=page.getByRole('toolbar'),grip=page.getByRole('button',{name:'Переместить панель',exact:true});
  await dockAt(page,12,400);await expect(palette).toHaveAttribute('data-edge','left');
  await page.getByRole('button',{name:'Свернуть панель инструментов',exact:true}).click();
  await expect(palette).toHaveAttribute('data-collapsed','true');expect((await palette.boundingBox())!.height).toBeLessThan(160);
  await page.getByRole('button',{name:'Развернуть панель',exact:true}).click();await page.reload();
  await expect(palette).toHaveAttribute('data-edge','left');await page.setViewportSize({width:820,height:1180});
  await expect.poll(async()=>{const b=(await palette.boundingBox())!;return b.x>=8&&b.x+b.width<=812&&b.y>=56&&b.y+b.height<=1138;}).toBe(true);
  await grip.focus();await page.keyboard.press('Alt+ArrowRight');await expect(palette).toHaveAttribute('data-edge','right');
  await page.keyboard.press('Home');await expect(palette).toHaveAttribute('data-edge','top');
  await page.getByRole('button',{name:'Режим письма',exact:true}).click();await expect(page.locator('.editor-header')).toBeHidden();
  await page.screenshot({path:'test-results/floating-palette-ipad.png'});
});

test('document header hides on downward scroll and returns on upward scroll or reveal', async ({ page }) => {
  await page.setViewportSize({width:1180,height:820});await create(page);
  const header=page.locator('.editor-header'),view=page.getByTestId('page-viewport');
  const original=(await view.boundingBox())!.height;
  await page.mouse.move(900,400);await page.mouse.wheel(0,320);await expect(header).toBeHidden();
  await expect.poll(async()=>(await view.boundingBox())!.height).toBeGreaterThan(original+35);
  await page.mouse.wheel(0,-180);await expect(header).toBeVisible();
  await page.mouse.wheel(0,350);await expect(header).toBeHidden();
  await page.getByRole('button',{name:'Показать меню документа',exact:true}).click();await expect(header).toBeVisible();
  expect(await objects(page)).toHaveLength(0);
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
