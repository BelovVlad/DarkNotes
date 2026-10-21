import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, GripVertical, PenLine } from 'lucide-react';
import { ToolPopover } from './ToolPopover';

type Edge = 'top' | 'bottom' | 'left' | 'right';
type Docking = { edge: Edge; ratio: number };
const key = 'darknotes-tool-palette-v2';
const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));
function restore(preference: 'top' | 'bottom'): Docking {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    if (value?.preference === preference && ['top', 'bottom', 'left', 'right'].includes(value.edge) && Number.isFinite(value.ratio)) return { edge: value.edge, ratio: clamp(value.ratio, 0, 1) };
  } catch { /* Private browsing may disable preferences. */ }
  return { edge: window.innerWidth < 600 ? 'bottom' : preference, ratio: .5 };
}

/** Docking uses pointer capture, so dragging never reaches the drawing canvas. */
export function FloatingToolbar({ children, dock, topInset = 56, panel, onCollapse }: {
  children: ReactNode; dock: 'top' | 'bottom'; topInset?: number; panel?: ReactNode; onCollapse: () => void;
}) {
  const [initial] = useState(() => restore(dock));
  const docking = useRef<Docking>(initial);
  const [edge, setEdge] = useState<Edge>(initial.edge);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [collapsed, setCollapsed] = useState(false), [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; offsetX: number; offsetY: number; original: Docking; point: { x: number; y: number } } | null>(null);
  const layoutRef = useRef<() => void>(() => {});
  const vertical = edge === 'left' || edge === 'right';
  const remember = () => { try { localStorage.setItem(key, JSON.stringify({ ...docking.current, preference: dock })); } catch { /* Preferences are optional. */ } };
  useLayoutEffect(() => {
    const element = ref.current!, parent = element.parentElement!;
    const layout = () => {
      const { edge } = docking.current, horizontal = edge === 'top' || edge === 'bottom';
      const travelX = Math.max(0, parent.clientWidth - element.offsetWidth - 16);
      const travelY = Math.max(0, parent.clientHeight - element.offsetHeight - topInset - 42);
      if (drag.current) {
        const desired = horizontal ? drag.current.point.x - drag.current.offsetX - 8 : drag.current.point.y - drag.current.offsetY - topInset;
        docking.current.ratio = clamp(desired / Math.max(1, horizontal ? travelX : travelY), 0, 1);
      }
      const ratio = docking.current.ratio;
      const x = horizontal ? 8 + travelX * ratio : edge === 'left' ? 8 : parent.clientWidth - element.offsetWidth - 8;
      const y = horizontal ? edge === 'top' ? topInset : parent.clientHeight - element.offsetHeight - 42 : topInset + travelY * ratio;
      setPosition(previous => previous?.x === x && previous?.y === y ? previous : { x, y });
    };
    layoutRef.current = layout; layout();
    const observer = new ResizeObserver(layout); observer.observe(parent); observer.observe(element);
    return () => observer.disconnect();
  }, [edge, collapsed, topInset]);
  const changeEdge = (next: Edge) => { docking.current.edge = next; setEdge(next); layoutRef.current(); };
  const end = (cancel = false) => {
    if (!drag.current) return;
    if (cancel) { docking.current = drag.current.original; setEdge(docking.current.edge); }
    drag.current = null; setDragging(false); layoutRef.current(); if (!cancel) remember();
  };
  return <>
    {dragging && <div className={`palette-dock-indicator dock-${edge}`} style={{ '--dock-top': `${topInset}px` } as React.CSSProperties} aria-hidden/>}
    <div ref={ref} className={`editor-toolbar floating-toolbar ${vertical ? 'vertical' : 'horizontal'} ${collapsed ? 'collapsed' : ''} ${dragging ? 'dragging' : ''}`}
      role="toolbar" aria-label="Инструменты рисования" aria-orientation={vertical ? 'vertical' : 'horizontal'} data-edge={edge} data-collapsed={collapsed}
      style={{ ...(position ? { left: position.x, top: position.y } : { visibility: 'hidden' }), '--palette-height': `calc(100% - ${topInset + 42}px)` } as React.CSSProperties & { '--palette-height': string }}>
      <button className="palette-grip" aria-label="Переместить панель" title="Перетащите к краю · стрелки — перемещение · Alt + стрелка — край · Home — сброс"
        onPointerDown={event => {
          if (event.button !== 0) return; event.preventDefault(); onCollapse();
          event.currentTarget.setPointerCapture(event.pointerId);
          const rect = ref.current!.getBoundingClientRect(), parent = ref.current!.parentElement!.getBoundingClientRect();
          drag.current = { id: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, original: { ...docking.current }, point: { x: event.clientX - parent.left, y: event.clientY - parent.top } };
          setDragging(true);
        }}
        onPointerMove={event => {
          const start = drag.current; if (start?.id !== event.pointerId) return;
          const parent = ref.current!.parentElement!, rect = parent.getBoundingClientRect();
          const point = start.point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
          const distances: Record<Edge, number> = { left: point.x, right: parent.clientWidth - point.x, top: point.y - topInset, bottom: parent.clientHeight - 42 - point.y };
          const closest = (Object.keys(distances) as Edge[]).reduce((a, b) => distances[a] < distances[b] ? a : b);
          if (distances[closest] + 24 < distances[docking.current.edge]) changeEdge(closest);
          else layoutRef.current();
        }}
        onPointerUp={() => end()} onPointerCancel={() => end(true)} onLostPointerCapture={() => end(true)}
        onKeyDown={event => {
          const directions: Record<string, Edge> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'top', ArrowDown: 'bottom' };
          const next = directions[event.key];
          if (next) {
            event.preventDefault();
            if (event.altKey) { onCollapse(); docking.current.ratio = .5; changeEdge(next); }
            else {
              const element = ref.current!, parent = element.parentElement!;
              const along = vertical ? next === 'top' || next === 'bottom' : next === 'left' || next === 'right';
              if (along) { const travel = vertical ? parent.clientHeight - topInset - 42 - element.offsetHeight : parent.clientWidth - 16 - element.offsetWidth;
                docking.current.ratio = clamp(docking.current.ratio + (next === 'left' || next === 'top' ? -1 : 1) * (event.shiftKey ? 40 : 10) / Math.max(1, travel), 0, 1); layoutRef.current(); }
            }
            remember();
          }
          if (event.key === 'Home') { event.preventDefault(); onCollapse(); docking.current = { edge: dock, ratio: .5 }; changeEdge(dock); remember(); }
        }}><GripVertical size={17}/></button>
      <div className="palette-content" hidden={collapsed}>{children}</div>
      {collapsed && <button className="palette-reopen" aria-label="Развернуть панель" onClick={() => setCollapsed(false)}><PenLine size={21}/><span>Инструменты</span></button>}
      <button className="palette-collapse icon-button" aria-label={collapsed ? 'Развернуть панель инструментов' : 'Свернуть панель инструментов'} aria-expanded={!collapsed}
        onClick={() => { if (!collapsed) onCollapse(); setCollapsed(!collapsed); }}>{collapsed ? <ChevronUp size={17}/> : <ChevronDown size={17}/>}</button>
    </div>
    {panel && !collapsed && <ToolPopover anchor={ref} onClose={onCollapse} placement={opposite[edge]} className="pen-popover" label="Настройки выбранного инструмента">{panel}</ToolPopover>}
  </>;
}
