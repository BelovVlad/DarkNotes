import { useState } from 'react';
import { Check } from 'lucide-react';
import { blankPage, covers, newDocument, type NoteDocument, type Paper } from '../model';
import { DARK_PAPER, LIGHT_PAPER, useDarkTheme } from '../appearance';
import { Modal } from './Modal';

export function NewNotebook({folderId,onCreate,onClose}:{folderId:string|null;onCreate:(doc:NoteDocument)=>void;onClose:()=>void}) {
 const dark=useDarkTheme();
 const [title,setTitle]=useState(''),[color,setColor]=useState(covers[0]),[format,setFormat]=useState('A4'),[landscape,setLandscape]=useState(false),[paper,setPaper]=useState<Paper>('grid'),[automatic,setAutomatic]=useState(true),[paperColor,setPaperColor]=useState(dark?DARK_PAPER:LIGHT_PAPER);
 return <Modal title="Новая тетрадь" onClose={onClose}><form className="new-notebook-form" onSubmit={e=>{
   e.preventDefault();const sizes:Record<string,number[]>={A4:[794,1123],A5:[559,794],Letter:[816,1056],Square:[900,900]};let [width,height]=sizes[format];if(landscape)[width,height]=[height,width];
   onCreate(newDocument(title.trim()||'Без названия',{folderId,color,pages:[blankPage({width,height,paper,paperColor,paperTheme:automatic?'auto':'custom'})]}));
 }}>
  <label>Название<input autoFocus maxLength={120} placeholder="Например, квантовая механика" value={title} onChange={e=>setTitle(e.target.value)}/></label>
  <div className="form-grid"><label>Формат<select value={format} onChange={e=>setFormat(e.target.value)}><option>A4</option><option>A5</option><option>Letter</option><option value="Square">Квадрат</option></select></label><label>Ориентация<select value={String(landscape)} onChange={e=>setLandscape(e.target.value==='true')}><option value="false">Книжная</option><option value="true">Альбомная</option></select></label></div>
  <label>Разметка<div className="paper-options" style={{'--paper-preview':automatic?(dark?DARK_PAPER:LIGHT_PAPER):paperColor} as React.CSSProperties}>{([['blank','Чистая'],['grid','Клетка'],['ruled','Линейка'],['dots','Точки']] as [Paper,string][]).map(([p,t])=><button type="button" key={p} className={`paper-option ${p} ${paper===p?'chosen':''}`} aria-pressed={paper===p} onClick={()=>setPaper(p)}><span/>{t}</button>)}</div></label>
  <label className="inline-label theme-paper-toggle"><span>Бумага в цвет темы<small>Чернила адаптируются к тёмному и белому листу</small></span><input type="checkbox" checked={automatic} onChange={e=>setAutomatic(e.target.checked)}/></label>
  {!automatic&&<label className="inline-label">Свой цвет бумаги<input type="color" value={paperColor} onChange={e=>setPaperColor(e.target.value)}/></label>}
  <label>Обложка<div className="swatches">{covers.map(c=><button type="button" key={c} className={`swatch ${color===c?'chosen':''}`} aria-label={`Обложка ${c}`} style={{background:c}} onClick={()=>setColor(c)}>{color===c&&<Check size={16}/>}</button>)}</div></label>
  <div className="modal-footer"><button className="button" type="button" onClick={onClose}>Отмена</button><button className="button primary" type="submit">Создать тетрадь</button></div>
 </form></Modal>;
}
