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
 const bottomGap=await page.getByTestId('page-viewport').evaluate(el=>el.getBoundingClientRect().bottom-el.querySelector('.lazy-page:last-child')!.getBoundingClientRect().bottom);
 expect(Math.abs(bottomGap)).toBeLessThanOrEqual(1);await expect(page.locator('.page-extension')).toHaveCount(0);
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
 await page.addStyleTag({content:':root { --safe-bottom:34px; }'});
 expect(await page.getByTestId('page-viewport').evaluate(el=>innerHeight-el.getBoundingClientRect().bottom)).toBe(0);
 await expect(page.locator('html')).toHaveClass(/standalone-app/);
 await page.screenshot({path:'test-results/ipad-safe-area.png'});
});

test('pen priority rejects palms across the writing surface and between strokes',async({page,context})=>{
 await page.setViewportSize({width:1180,height:820});await create(page);
 const cdp=await context.newCDPSession(page),canvas=page.getByTestId('drawing-canvas'),box=(await canvas.boundingBox())!;
 const view=page.getByTestId('page-viewport');
 const state=()=>page.evaluate(()=>({top:document.querySelector('.page-viewport')!.scrollTop,width:document.querySelector('.page-frame')!.getBoundingClientRect().width}));
 const touch=async(target:'canvas'|'gutter',id:number,type:string,x:number,y:number,width=10)=>{
  await page.evaluate(({target,id,type,x,y,width})=>{
   const el=document.querySelector(target==='canvas'?'.active-layer':'.page-viewport')!;
   el.dispatchEvent(new PointerEvent(type,{pointerType:'touch',pointerId:id,clientX:x,clientY:y,width,height:width,button:0,buttons:type==='pointerup'?0:1,bubbles:true,cancelable:true}));
  },{target,id,type,x,y,width});
 };
 const initial=await state();
 await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:box.x+150,y:box.y+200,button:'left',buttons:1,pointerType:'pen',force:.4});
 await touch('canvas',81,'pointerdown',700,500);await touch('gutter',82,'pointerdown',8,500);
 await touch('canvas',81,'pointermove',800,200);await touch('gutter',82,'pointermove',8,200);
 await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:box.x+300,y:box.y+200,button:'left',buttons:1,pointerType:'pen',force:.6});
 await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:box.x+300,y:box.y+200,button:'left',buttons:0,pointerType:'pen'});
 // A resting palm stays blocked after pen lift.
 for(const [target,id] of [['canvas',81],['gutter',82]] as const){await touch(target,id,'pointermove',600,150);await touch(target,id,'pointerup',600,150);}
 expect(await state()).toEqual(initial);
 await expect.poll(async()=>(await current(page)).pages[0].objects.length).toBe(1);
 // A fresh, normal-sized finger works immediately, including with pen hover.
 await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await canvas.dispatchEvent('pointermove',{pointerType:'pen',pointerId:95,clientX:400,clientY:300,bubbles:true});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:800,y:600,id:1,radiusX:20,radiusY:18}]});
 await canvas.dispatchEvent('pointermove',{pointerType:'pen',pointerId:95,clientX:405,clientY:300,bubbles:true});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:800,y:400,id:1,radiusX:20,radiusY:18}]});
 expect((await state()).top).toBeGreaterThan(initial.top+50);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
});

test('notebook chrome cannot be selected while editable fields remain usable',async({page})=>{
 await create(page);const label=page.locator('.editor-title>span'),box=(await label.boundingBox())!;
 await page.mouse.move(box.x+3,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+240,box.y+140,{steps:12});await page.mouse.up();
 expect(await page.evaluate(()=>getSelection()?.toString())).toBe('');
 expect(await page.getByTestId('page-viewport').evaluate(el=>el.dispatchEvent(new Event('selectstart',{bubbles:true,cancelable:true})))).toBe(false);
 const title=page.getByRole('textbox',{name:'Название документа',exact:true});await title.fill('Исправленная тетрадь');await expect(title).toHaveValue('Исправленная тетрадь');
});

test('pen arrival cancels an existing touch gesture and fresh two-finger zoom still works',async({page,context})=>{
 await page.setViewportSize({width:1180,height:820});await create(page);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 const fingers=(x1:number,x2:number,y:number)=>[{id:1,x:x1,y,radiusX:20,radiusY:18},{id:2,x:x2,y,radiusX:20,radiusY:18}];
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:fingers(650,850,600)});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:fingers(650,850,570)});
 const canvas=page.getByTestId('drawing-canvas'),box=(await canvas.boundingBox())!;
 await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:box.x+200,y:250,button:'left',buttons:1,pointerType:'pen',force:.4});
 await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:box.x+300,y:250,button:'left',buttons:1,pointerType:'pen',force:.5});
 await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:box.x+300,y:250,button:'left',buttons:0,pointerType:'pen'});
 const snapshot=()=>page.evaluate(()=>({top:document.querySelector('.page-viewport')!.scrollTop,width:document.querySelector('.page-frame')!.getBoundingClientRect().width}));
 const held=await snapshot();
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:fingers(580,920,450)});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 expect(await snapshot()).toEqual(held);await expect.poll(async()=>(await current(page)).pages[0].objects.length).toBe(1);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:fingers(650,850,550)});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:fingers(600,900,550)});
 await expect.poll(async()=>(await snapshot()).width).toBeGreaterThan(held.width+50);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});expect(errors).toEqual([]);
});

test('committing strokes leaves paper, previous ink and viewport stable with a quiet save indicator',async({page})=>{
 await page.setViewportSize({width:1180,height:820});await create(page);
 await expect(page.locator('[data-save-state=saved]')).toBeVisible();
 await page.getByTestId('drawing-canvas').evaluate(canvas=>{
  const ink=canvas.parentElement!.querySelector('.ink-layer') as HTMLCanvasElement;
  const paper=canvas.parentElement!.querySelector('.paper-layer')!;
  const stats=(window as any).inkStats={clears:0,resizes:0,replaced:false,activeAtRelease:[] as boolean[]};
  const ctx=ink.getContext('2d')!,clear=ctx.clearRect.bind(ctx);ctx.clearRect=(...args)=>{stats.clears++;clear(...args);};
  new MutationObserver(records=>stats.resizes+=records.length).observe(paper,{attributes:true,attributeFilter:['width','height']});
  canvas.addEventListener('pointerup',()=>{stats.replaced=document.querySelector('.active-layer')!==canvas;stats.activeAtRelease.push((canvas as HTMLCanvasElement).getContext('2d')!.getImageData(0,0,(canvas as HTMLCanvasElement).width,(canvas as HTMLCanvasElement).height).data.some((n,i)=>i%4===3&&n>0));});
 });
 const view=page.getByTestId('page-viewport'),before=await view.evaluate(el=>({top:el.scrollTop,width:el.querySelector('.page-frame')!.getBoundingClientRect().width}));
 const b=(await page.getByTestId('drawing-canvas').boundingBox())!;
 for(let i=0;i<3;i++){await page.mouse.move(b.x+180,b.y+240+i*50);await page.mouse.down();await page.mouse.move(b.x+360,b.y+240+i*50,{steps:8});await page.mouse.up();}
 await expect.poll(async()=>(await current(page)).pages[0].objects.length).toBe(3);
 await expect(page.locator('[data-save-state=saved]')).toBeVisible();
 expect(await view.evaluate(el=>({top:el.scrollTop,width:el.querySelector('.page-frame')!.getBoundingClientRect().width}))).toEqual(before);
 expect(await page.evaluate(()=>(window as any).inkStats)).toEqual({clears:0,resizes:0,replaced:false,activeAtRelease:[false,false,false]});
 await expect(page.locator('.save-indicator')).toHaveText('Автосохранение');await expect(page.locator('.save-indicator .spin')).toHaveCount(0);
 await page.getByRole('button',{name:'Отменить (Ctrl+Z)',exact:true}).click();await expect.poll(async()=>(await current(page)).pages[0].objects.length).toBe(2);
 expect(await page.evaluate(()=>(window as any).inkStats.clears)).toBeGreaterThan(0);
});
