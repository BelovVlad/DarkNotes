export type Point = { x: number; y: number; p: number; t: number; tiltX?: number; tiltY?: number };
export type Tool = 'pen' | 'highlighter' | 'eraser' | 'lasso' | 'rect-select' | 'line' | 'rectangle' | 'ellipse' | 'arrow' | 'text' | 'hand';
export type Paper = 'blank' | 'grid' | 'ruled' | 'dots';
export type Stroke = { id: string; kind: 'stroke'; points: Point[]; color: string; width: number; opacity: number; pen: 'regular' | 'ballpoint' | 'fountain'; highlighter: boolean; pressure?: boolean };
export type TextObject = { id: string; kind: 'text'; x: number; y: number; width: number; height: number; text: string; color: string; size: number };
export type ImageObject = { id: string; kind: 'image'; x: number; y: number; width: number; height: number; data: string };
export type InkObject = Stroke | TextObject | ImageObject;
export type NotePage = { id: string; width: number; height: number; paper: Paper; paperColor: string; paperTheme?: 'auto'|'custom'; rotation: number; objects: InkObject[]; pdfIndex?: number; bookmark?: boolean };
export type NoteDocument = { id: string; title: string; folderId: string | null; color: string; created: number; updated: number; opened: number; favorite: boolean; deleted: number | null; pages: NotePage[]; pdfAsset?: string; type: 'notebook' | 'pdf' };
export type Folder = { id: string; title: string; parentId: string | null; color: string; collapsed?: boolean };
export type PenPreset = { color: string; width: number; opacity: number; pen: Stroke['pen'] };
export type Settings = {
  theme: 'dark' | 'light' | 'system'; accent: string; compact: boolean; penOnly: boolean; pressure: boolean;
  smoothing: number; circleLasso: boolean; scribbleErase: boolean; shapeHold: boolean; holdMs: number;
  twoFingerUndo: boolean; doubleTapZoom: boolean; toolbar: 'top' | 'bottom'; scroll: 'single' | 'continuous';
  defaultTool: Tool; presets: PenPreset[];
};
export const defaultSettings: Settings = { theme: 'dark', accent: '#d64c50', compact: false, penOnly: false, pressure: true, smoothing: 0.45, circleLasso: true, scribbleErase: true, shapeHold: true, holdMs: 650, twoFingerUndo: true, doubleTapZoom: true, toolbar: 'top', scroll: 'single', defaultTool: 'pen', presets: [{color:'#252b28',width:3,opacity:1,pen:'regular'},{color:'#aa514b',width:3,opacity:1,pen:'fountain'},{color:'#517b69',width:3,opacity:1,pen:'ballpoint'}] };
export const uid = () => crypto.randomUUID();
export const covers = ['#b99b72', '#648577', '#7a849a', '#ad7771', '#8c7c97', '#a6a078', '#4e686d', '#70746b'];
export function blankPage(options: Partial<NotePage> = {}): NotePage { return { id: uid(), width: 794, height: 1123, paper: 'grid', paperColor: '#0e151c', rotation: 0, objects: [], ...options }; }
export function newDocument(title: string, options: Partial<NoteDocument> = {}): NoteDocument { const now = Date.now(); return { id: uid(), title, folderId: null, color: covers[0], created: now, updated: now, opened: now, favorite: false, deleted: null, type: 'notebook', pages: [blankPage()], ...options }; }
export const clone = <T,>(v: T): T => structuredClone(v);
