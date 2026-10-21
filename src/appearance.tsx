import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import type { NotePage, Settings } from './model';

export const DARK_PAPER = '#0e151c';
export const LIGHT_PAPER = '#ffffff';
// Each slot has the same meaning in both themes. Stored ink remains unchanged.
export const inkPairs = [
  ['#252b28', '#ead4b7'], ['#aa514b', '#ee8e88'], ['#517b69', '#91b9a3'],
  ['#346ca0', '#92b4db'], ['#946b24', '#e4c582'], ['#78559d', '#bca7d8'],
] as const;
const ThemeContext = createContext(true);
export const useDarkTheme = () => useContext(ThemeContext);
export function ThemeProvider({theme, children}:{theme:Settings['theme'];children:ReactNode}) {
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {const media=matchMedia('(prefers-color-scheme: dark)'),change=()=>setSystemDark(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  const dark=theme==='system'?systemDark:theme==='dark';
  useLayoutEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#080d12':'#ffffff');},[dark]);
  return <ThemeContext.Provider value={dark}>{children}</ThemeContext.Provider>;
}
export function isDark(color:string) {const c=color.replace('#',''),s=c.length===3?c.split('').map(v=>v+v).join(''):c;return parseInt(s.slice(0,2),16)*.2126+parseInt(s.slice(2,4),16)*.7152+parseInt(s.slice(4,6),16)*.0722<128;}
export function inkColor(color:string,dark?:boolean):string {
  if(dark===undefined)return color;
  const normalized=color.toLowerCase();
  for(const pair of inkPairs)if(pair.some(c=>c===normalized))return pair[dark?1:0];
  if(['#000000','#000','#ffffff','#fff','#222222','#202020'].includes(normalized))return inkPairs[0][dark?1:0];
  return color;
}
export function themedPage(page:NotePage,dark:boolean):NotePage {
  const adaptive=page.paperTheme==='auto'||(!page.paperTheme&&['#faf8f3','#ffffff',DARK_PAPER].includes(page.paperColor.toLowerCase()));
  return adaptive?{...page,paperColor:dark?DARK_PAPER:LIGHT_PAPER}:page;
}
export function pageIsDark(page:NotePage,dark:boolean) {return page.pdfIndex?dark:isDark(themedPage(page,dark).paperColor);}
// Recolour only when the source PDF background differs from the selected theme.
// Chromatic content keeps its hue; inserted photos are never passed through here.
export function themePdfCanvas(canvas:HTMLCanvasElement,dark:boolean) {
  const ctx=canvas.getContext('2d',{willReadFrequently:true})!,pixels=ctx.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
  const samples:number[]=[];
  for(let i=0;i<40;i++){const x=Math.floor(canvas.width*(i+.5)/40);for(const y of [2,Math.max(0,canvas.height-3)]){const p=(y*canvas.width+x)*4;samples.push((data[p]+data[p+1]+data[p+2])/3);}}
  samples.sort((a,b)=>a-b);const sourceDark=samples[Math.floor(samples.length/2)]<128;
  if(sourceDark===dark)return false;
  const bg=dark?[14,21,28]:[255,255,255],fg=dark?[234,212,183]:[37,43,40];
  for(let i=0;i<data.length;i+=4){const r=data[i],g=data[i+1],b=data[i+2],l=(r*.2126+g*.7152+b*.0722)/255,t=sourceDark?l:1-l,saturation=Math.max(r,g,b)-Math.min(r,g,b);for(let j=0;j<3;j++){const neutral=bg[j]+(fg[j]-bg[j])*t;data[i+j]=Math.max(0,Math.min(255,neutral+(saturation>25?([r,g,b][j]-l*255)*.65:0)));}}
  ctx.putImageData(pixels,0,0);return true;
}
