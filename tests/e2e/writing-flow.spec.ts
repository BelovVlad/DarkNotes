import { test, expect, type Page } from '@playwright/test';
test.use({reducedMotion:'no-preference'});
async function create(page:Page){await page.goto('/');await page.getByRole('button',{name:'Новая тетрадь',exact:true}).last().click();await page.getByPlaceholder('Например, квантовая механика').fill('Непрерывная тетрадь');await page.getByRole('dialog').getByRole('button',{name:'Создать тетрадь',exact:true}).click();await expect(page.getByTestId('drawing-canvas')).toBeVisible();}
async function current(page:Page){return page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('darknotes-v1');r.onsuccess=()=>resolve(r.result);});return new Promise<any>(resolve=>{const r=db.transaction('documents').objectStore('documents').get(location.hash.slice(5));r.onsuccess=()=>{resolve(r.result);db.close();};});});}

test('scrolling past the last page appends one blank template and the counter follows the visible page',async({page})=>{
 await page.setViewportSize({width:1180,height:820});await create(page);
 const counter=page.getByRole('button',{name:'Страницы и масштаб',exact:true});await expect(counter).toHaveText('1/1');
 await expect(page.getByRole('region',{name:'Навигация по документу',exact:true})).toHaveCount(0);
 await page.mouse.move(900,500);await page.mouse.wheel(0,6000);
 await expect.poll(()=>page.getByTestId('page-viewport').evaluate(el=>el.scrollHeight-el.clientHeight-el.scrollTop)).toBeLessThan(3);
 expect((await current(page)).pages).toHaveLength(1);
 await page.mouse.wheel(0,160);await expect.poll(async()=>(await current(page)).pages.length).toBe(2);
 const doc=await current(page);expect(doc.pages[1].objects).toEqual([]);expect(doc.pages[1].paper).toBe(doc.pages[0].paper);
 await expect(counter).toHaveText('2/2');await page.mouse.wheel(0,6000);expect((await current(page)).pages).toHaveLength(2);
 await page.getByRole('button',{name:'Показать меню документа',exact:true}).click();
 await page.getByRole('button',{name:'Параметры пера',exact:true}).click();
 await page.getByRole('button',{name:'Перьевая ручка',exact:true}).click();
 await expect(page.getByRole('button',{name:'Перьевая ручка',exact:true})).toHaveAttribute('aria-pressed','true');
 expect((await page.locator('.pen-popover').boundingBox())!.width).toBeLessThan(270);
 await page.screenshot({path:'test-results/writing-flow.png'});
});

test('finger flick continues moving after release and inertia never creates another page',async({page,context})=>{
 await page.setViewportSize({width:1180,height:820});await create(page);
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 const x=800;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:600,id:1}]});
 for(let i=1;i<=5;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:600-i*28,id:1}]});
 const view=page.getByTestId('page-viewport');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const released=await view.evaluate(el=>el.scrollTop);
 await expect.poll(()=>view.evaluate(el=>el.scrollTop)).toBeGreaterThan(released+35);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:500,id:2}]});
 const stopped=await view.evaluate(el=>el.scrollTop);
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 expect(await view.evaluate(el=>el.scrollTop)).toBe(stopped);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});expect((await current(page)).pages).toHaveLength(1);
});

test('very fast Pencil stroke keeps its release point and an interrupted pen stroke remains saved',async({page,context})=>{
 await create(page);const cdp=await context.newCDPSession(page),box=(await page.getByTestId('drawing-canvas').boundingBox())!;
 await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:box.x+130,y:box.y+190,button:'left',buttons:1,pointerType:'pen',force:.02});
 await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:box.x+360,y:box.y+190,button:'left',buttons:0,pointerType:'pen',force:0});
 await expect.poll(async()=>(await current(page)).pages[0].objects.length).toBe(1);
 const ink=(await current(page)).pages[0].objects[0];expect(ink.points.length).toBeGreaterThanOrEqual(2);
 expect(ink.points.at(-1).x).toBeCloseTo(360/box.width*794,0);expect(ink.points[0].p).toBeCloseTo(.02,2);
 const coverage=await page.locator('.ink-layer').first().evaluate((canvas:HTMLCanvasElement,{x0,x1,y})=>{
  const ctx=canvas.getContext('2d')!,sx=canvas.width/794,sy=canvas.height/1123;
  return Array.from({length:8},(_,i)=>{const x=(x0+(i+1)*(x1-x0)/9)*sx;return ctx.getImageData(Math.floor(x)-3,Math.floor(y*sy)-3,7,7).data.some((v,j)=>j%4===3&&v>0);});
 },{x0:ink.points[0].x,x1:ink.points.at(-1).x,y:ink.points[0].y});
 expect(coverage.every(Boolean)).toBe(true);
 await page.getByTestId('drawing-canvas').evaluate(canvas=>canvas.addEventListener('pointerdown',event=>(window as any).lastPenId=(event as PointerEvent).pointerId,{once:true}));
 await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:box.x+130,y:box.y+260,button:'left',buttons:1,pointerType:'pen',force:.4});
 await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:box.x+300,y:box.y+260,button:'left',buttons:1,pointerType:'pen',force:.6});
 await page.getByTestId('drawing-canvas').evaluate(canvas=>canvas.dispatchEvent(new PointerEvent('pointercancel',{pointerId:(window as any).lastPenId,pointerType:'pen',bubbles:true})));
 await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:box.x+300,y:box.y+260,button:'left',buttons:0,pointerType:'pen'});
 await expect.poll(async()=>(await current(page)).pages[0].objects.length).toBe(2);await page.reload();await expect(page.getByTestId('drawing-canvas')).toBeVisible();expect((await current(page)).pages[0].objects).toHaveLength(2);
});

test('installed iPad layout reserves a status-bar inset',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true,configurable:true}));
 await create(page);expect((await page.locator('.editor-header').boundingBox())!.y).toBeGreaterThanOrEqual(24);
 await expect(page.locator('html')).toHaveClass(/standalone-app/);
 await page.screenshot({path:'test-results/ipad-safe-area.png'});
});
