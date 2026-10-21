import { PDFDocument, rgb, degrees, BlendMode, type PDFPage, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { getStroke } from 'perfect-freehand';
import type { NoteDocument, NotePage, Stroke } from './model';
import { DARK_PAPER, LIGHT_PAPER, inkColor, isDark, themePdfCanvas } from './appearance';
import { getAsset } from './storage';
import { loadImage } from './engine/render';
import { renderPdfPage } from './pdf';

export type ExportOptions = {theme:'dark'|'light'|'original'; pattern:boolean};
const color=(hex:string)=>{const h=hex.slice(1),v=h.length===3?h.split('').map(x=>x+x).join(''):h;return rgb(parseInt(v.slice(0,2),16)/255,parseInt(v.slice(2,4),16)/255,parseInt(v.slice(4,6),16)/255);};
function drawPaperVector(out:PDFPage,page:NotePage,background:string,pattern:boolean) {
 out.drawRectangle({x:0,y:0,width:page.width,height:page.height,color:color(background)});
 if(!pattern||page.paper==='blank')return;
 const c=color(isDark(background)?'#82909c':'#71818b'),opacity=isDark(background)?.14:.19,step=page.paper==='ruled'?30:24;
 for(let y=36;y<page.height;y+=step){if(page.paper==='dots'){for(let x=24;x<page.width;x+=step)out.drawCircle({x,y:page.height-y,size:.9,color:c,opacity:opacity*1.6});}else out.drawLine({start:{x:0,y:page.height-y},end:{x:page.width,y:page.height-y},color:c,thickness:.65,opacity});}
 if(page.paper==='grid')for(let x=24;x<page.width;x+=step)out.drawLine({start:{x,y:0},end:{x,y:page.height},color:c,thickness:.65,opacity});
}
function strokeSvg(stroke:Stroke) {
 const points=getStroke(stroke.points.map(p=>[p.x,p.y,stroke.pressure===false?.5:p.p]),{size:stroke.width,thinning:stroke.highlighter||stroke.pen==='ballpoint'?0:stroke.pen==='fountain'?.7:.35,smoothing:.55,streamline:0,simulatePressure:false,last:true});
 if(!points.length)return '';
 return `M ${points[0][0]} ${points[0][1]} `+points.slice(1).map((a,i)=>{const b=points[(i+2)%points.length];return `Q ${a[0]} ${a[1]} ${(a[0]+b[0])/2} ${(a[1]+b[1])/2}`;}).join(' ')+' Z';
}
async function canvasPng(canvas:HTMLCanvasElement) {return new Uint8Array(await(await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Не удалось подготовить изображение')),'image/png'))).arrayBuffer());}

export async function exportPdf(doc:NoteDocument,onProgress?:(n:number)=>void,options:ExportOptions={theme:'original',pattern:true}) {
 const composition=await PDFDocument.create(),result=await PDFDocument.create();composition.registerFontkit(fontkit);
 result.setTitle(doc.title);result.setCreator('DarkNotes');
 let source:PDFDocument|undefined,font:PDFFont|undefined;
 if(doc.pdfAsset)source=await PDFDocument.load(await(await getAsset(doc.pdfAsset)).arrayBuffer());
 for(let i=0;i<doc.pages.length;i++){
  const page=doc.pages[i],canonical=composition.addPage([page.width,page.height]),dark=options.theme==='original'?isDark(page.paperColor):options.theme==='dark',background=options.theme==='original'?page.paperColor:dark?DARK_PAPER:LIGHT_PAPER;
  drawPaperVector(canonical,{...page,paper:page.pdfIndex?'blank':page.paper},background,options.pattern);
  if(page.pdfIndex&&doc.pdfAsset&&source){
   const bg=document.createElement('canvas');await renderPdfPage(doc.pdfAsset,page.pdfIndex,bg,2);
   const recoloured=options.theme!=='original'&&themePdfCanvas(bg,dark);
   if(recoloured){const image=await composition.embedPng(await canvasPng(bg));canonical.drawImage(image,{x:0,y:0,width:page.width,height:page.height});}
   else {
    const original=source.getPage(page.pdfIndex-1),box=original.getCropBox();
    // Blank source pages have no content stream to embed.
    if(original.node.Contents()){
     const embedded=await composition.embedPage(original,{left:box.x,bottom:box.y,right:box.x+box.width,top:box.y+box.height});
     const rotation=((original.getRotation().angle%360)+360)%360,odd=rotation%180!==0,w=odd?page.height:page.width,h=odd?page.width:page.height;
     canonical.drawPage(embedded,{width:w,height:h,rotate:degrees(-rotation),x:rotation===180?w:rotation===270?h:0,y:rotation===90?w:rotation===180?h:0});
    }
   }
   bg.width=0;
  }
  for(const object of page.objects){
   const selectedDark=options.theme==='original'?undefined:dark;
   if(object.kind==='stroke'){const path=strokeSvg(object);if(path)canonical.drawSvgPath(path,{x:0,y:page.height,color:color(inkColor(object.color,selectedDark)),opacity:object.opacity,blendMode:object.highlighter?(dark?BlendMode.Screen:BlendMode.Multiply):BlendMode.Normal});}
   else if(object.kind==='text'){
    if(!font){const bytes=await(await fetch(import.meta.env.BASE_URL+'pdf/standard_fonts/LiberationSans-Regular.ttf')).arrayBuffer();font=await composition.embedFont(bytes,{subset:true});}
    const supported=new Set(font.getCharacterSet());
    object.text.split('\n').forEach((line,n)=>{const safe=Array.from(line).map(c=>supported.has(c.codePointAt(0)!)?c:'□').join('');canonical.drawText(safe,{x:object.x,y:page.height-object.y-object.size-n*object.size*1.35,size:object.size,font,color:color(inkColor(object.color,selectedDark))});});
   }else {
    const image=await loadImage(object.data),canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d')!.drawImage(image,0,0);const embedded=await composition.embedPng(await canvasPng(canvas));canonical.drawImage(embedded,{x:object.x,y:page.height-object.y-object.height,width:object.width,height:object.height});canvas.width=0;
   }
  }
  // Materialise nested PDF forms and font subsets before copying their references.
  await composition.flush();
  const odd=page.rotation%180!==0,out=result.addPage(odd?[page.height,page.width]:[page.width,page.height]),embedded=await result.embedPage(canonical),rotation=page.rotation;
  out.drawPage(embedded,{width:page.width,height:page.height,rotate:degrees(-rotation),x:rotation===180?page.width:rotation===270?page.height:0,y:rotation===90?page.width:rotation===180?page.height:0});
  onProgress?.(i+1);
 }
 return new Blob([await result.save() as Uint8Array<ArrayBuffer>],{type:'application/pdf'});
}
