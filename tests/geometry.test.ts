import { describe, expect, it } from 'vitest';
import { blankPage, newDocument, type InkObject, type Point, type Stroke } from '../src/model';
import { bounds, eraseAt, inPolygon, isClosed, isScribble, recognizeShape, scaleObject, scribbleTargets, selectInside, SpatialIndex, translate } from '../src/engine/geometry';
import { History } from '../src/engine/history';
const points=(pairs:number[][],dt=8):Point[]=>pairs.map(([x,y],i)=>({x,y,p:.5,t:i*dt}));
const stroke=(pairs:number[][],id='ink'):Stroke=>({id,kind:'stroke',points:points(pairs),color:'#111111',width:3,opacity:1,pen:'regular',highlighter:false});
const circle=points(Array.from({length:65},(_,i)=>[100+80*Math.cos(i*Math.PI/32),100+70*Math.sin(i*Math.PI/32)]));
describe('lasso geometry',()=>{
 it('recognizes closed irregular contours, not a line or tiny dot',()=>{expect(isClosed(circle)).toBe(true);expect(isClosed(points([[0,0],[100,0]]))).toBe(false);expect(isClosed(points(Array.from({length:20},(_,i)=>[Math.cos(i),Math.sin(i)])))).toBe(false);});
 it('respects a concave polygon notch and includes boundary points',()=>{const polygon=points([[0,0],[100,0],[100,100],[60,100],[60,40],[40,40],[40,100],[0,100]]);expect(inPolygon({x:20,y:70},polygon)).toBe(true);expect(inPolygon({x:50,y:70},polygon)).toBe(false);expect(inPolygon({x:0,y:50},polygon)).toBe(true);expect(selectInside([stroke([[15,60],[25,70]],'inside'),stroke([[45,70],[55,75]],'outside')],polygon)).toEqual(['inside']);});
 it('selects text and images by their geometry, without text recognition',()=>{const objects:InkObject[]=[{id:'text',kind:'text',x:70,y:70,width:30,height:20,text:'∫x dx',color:'#000',size:20},{id:'image',kind:'image',x:220,y:220,width:10,height:10,data:''}];expect(selectInside(objects,circle)).toEqual(['text']);});
 it('leaves a normal circle as ink when there are no enclosed objects',()=>{expect(selectInside([],circle)).toEqual([]);expect(isScribble(circle)).toBe(false);});
 it('moves and scales the actual document coordinates',()=>{const o=stroke([[10,20],[30,40]]);const moved=translate(o,90,40) as Stroke;expect(moved.points[0]).toMatchObject({x:100,y:60,p:.5});const scaled=scaleObject(o,bounds(o.points),2) as Stroke;expect(scaled.points[1]).toMatchObject({x:50,y:60});expect(o.points[0].x).toBe(10);});
});
describe('scribble recognition and false positives',()=>{
 const zigzag=Array.from({length:36},(_,i)=>[i%2?130:40,80+i*.5]);
 it('recognizes repeated rapid reversals, not slow deliberate hatching',()=>{expect(isScribble(points(zigzag,15))).toBe(true);expect(isScribble(points(zigzag,100))).toBe(false);});
 it('only erases ink intersected by the scribble',()=>{const targets=scribbleTargets([stroke([[70,70],[70,120]],'error'),stroke([[200,70],[200,120]],'neighbor')],points(zigzag));expect(targets).toEqual(['error']);});
 it('preserves a neighboring stroke touched by only the departing tail',()=>{
  const gesture=points([...zigzag,[180,98],[210,98]]);
  expect(scribbleTargets([stroke([[70,70],[70,120]],'error'),stroke([[200,70],[200,120]],'neighbor')],gesture)).toEqual(['error']);
 });
 const math:Record<string,number[][]>={integral:[[40,10],[32,0],[22,6],[20,30],[20,70],[18,95],[7,100],[0,90]],fraction:[[0,50],[100,50]],sigma:[[100,0],[0,0],[50,50],[0,100],[100,100]],alpha:[[80,60],[60,30],[30,35],[20,60],[30,80],[60,75],[80,30],[70,75],[95,80]],arrow:[[0,50],[100,50],[80,30],[100,50],[80,70]],subscript:[[0,0],[8,8],[0,16],[8,24]]};
 for(const [symbol,pairs] of Object.entries(math))it(`does not erase a mathematical ${symbol}`,()=>expect(isScribble(points(pairs))).toBe(false));
 it('does not mistake a normal circle or rectangle for an eraser',()=>{expect(isScribble(circle)).toBe(false);expect(isScribble(points([[0,0],[100,0],[100,100],[0,100],[0,0]]))).toBe(false);});
});
describe('eraser, index and history',()=>{
 it('splits a sparse segment into fragments instead of deleting the entire stroke',()=>{const result=eraseAt([stroke([[0,20],[200,20]])],{x:100,y:20},15,false) as Stroke[];expect(result).toHaveLength(2);expect(result[0].points.at(-1)!.x).toBeLessThan(100);expect(result[1].points[0].x).toBeGreaterThan(100);expect(eraseAt([stroke([[0,20],[200,20]])],{x:100,y:20},15,true)).toEqual([]);});
 it('indexes long sparse strokes across every occupied cell',()=>{const o=stroke([[0,0],[500,500]]),index=new SpatialIndex([o]);expect(index.query({x:250,y:250},10)).toEqual([o]);expect(index.query({x:1000,y:1000},10)).toEqual([]);});
 it('undoes drawing, movement and erasure with redo and isolated snapshots',()=>{const h=new History(),base=[blankPage()],drawn=[{...base[0],objects:[stroke([[10,20],[50,60]])]}];h.push(base);h.push(drawn);const moved=[{...drawn[0],objects:drawn[0].objects.map(o=>translate(o,30,0))}];h.push(moved);const erased=[{...moved[0],objects:[]}];expect(h.undo(erased)).toEqual(moved);expect(h.undo(moved)).toEqual(drawn);expect(h.redo(drawn)).toEqual(moved);h.push(drawn);expect(h.future).toEqual([]);});
 it('straightens a line and recognizes a circle',()=>{expect(recognizeShape(points([[0,0],[10,1],[50,-1],[100,0]]))).toHaveLength(2);expect(recognizeShape(circle)?.length).toBeGreaterThan(4);});
 it('creates standalone documents without any OCR state',()=>{const doc=newDocument('Физика');expect(doc.pages).toHaveLength(1);expect(JSON.stringify(doc)).not.toContain('ocr');});
});
