import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, GripVertical, PenLine } from 'lucide-react';

type Position = { x: number; y: number };
const storageKey = 'darknotes-tool-palette-v1';
function readPosition(dock: 'top' | 'bottom'): Position | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
    return value && (!value.dock || value.dock === dock) && Number.isFinite(value.x) && Number.isFinite(value.y) ? value : null;
  } catch { return null; }
}

/** Pointer capture keeps dragging off the drawing surface, including with Pencil. */
export function FloatingToolbar({ children, dock, onCollapse }: {
  children: ReactNode; dock: 'top' | 'bottom'; onCollapse: () => void;
}) {
  const [position, setPosition] = useState<Position | null>(() => readPosition(dock));
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; origin: Position } | null>(null);
  const current = useRef(position);
  const clamp = (point: Position): Position => {
    const element = ref.current!, parent = element.parentElement!;
    const top = parent.classList.contains('writing-focus') ? 8 : 56;
    return {
      x: Math.max(8, Math.min(point.x, parent.clientWidth - element.offsetWidth - 8)),
      y: Math.max(top, Math.min(point.y, parent.clientHeight - element.offsetHeight - 42)),
    };
  };
  const place = (point: Position) => { current.current = point; setPosition(point); };
  const remember = () => {
    try { localStorage.setItem(storageKey, JSON.stringify({ ...current.current, dock })); } catch { /* Storage may be disabled. */ }
  };
  useLayoutEffect(() => {
    const element = ref.current!, parent = element.parentElement!;
    const resize = () => {
      const point = current.current || {
        x: (parent.clientWidth - element.offsetWidth) / 2,
        y: dock === 'top' && parent.clientWidth >= 600 ? 64 : parent.clientHeight - element.offsetHeight - 48,
      };
      place(clamp(point));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(parent); observer.observe(element);
    return () => observer.disconnect();
  }, [dock]);
  return <div ref={ref} className={`editor-toolbar floating-toolbar ${collapsed ? 'collapsed' : ''} ${dragging ? 'dragging' : ''}`}
    role="toolbar" aria-label="Инструменты рисования" data-collapsed={collapsed} data-edge={position && position.y > window.innerHeight / 2 ? 'bottom' : 'top'}
    style={position ? { left: position.x, top: position.y } : { visibility: 'hidden' }}>
    <button className="palette-grip" aria-label="Переместить панель" title="Перетащите панель · стрелки для перемещения · Home для сброса"
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault();
        onCollapse();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, origin: current.current! };
        setDragging(true);
      }}
      onPointerMove={event => {
        const start = drag.current;
        if (start?.id === event.pointerId) place(clamp({ x: start.origin.x + event.clientX - start.x, y: start.origin.y + event.clientY - start.y }));
      }}
      onPointerUp={() => { drag.current = null; setDragging(false); remember(); }}
      onPointerCancel={() => { if (drag.current) place(clamp(drag.current.origin)); drag.current = null; setDragging(false); }}
      onLostPointerCapture={() => { drag.current = null; setDragging(false); }}
      onKeyDown={event => {
        const amount = event.shiftKey ? 40 : 10;
        const directions: Record<string, Position> = { ArrowLeft: { x: -amount, y: 0 }, ArrowRight: { x: amount, y: 0 }, ArrowUp: { x: 0, y: -amount }, ArrowDown: { x: 0, y: amount } };
        const delta = directions[event.key];
        if (delta) { event.preventDefault(); place(clamp({ x: current.current!.x + delta.x, y: current.current!.y + delta.y })); remember(); }
        if (event.key === 'Home') { event.preventDefault(); place(clamp({ x: (ref.current!.parentElement!.clientWidth - ref.current!.offsetWidth) / 2, y: dock === 'top' ? 64 : ref.current!.parentElement!.clientHeight - ref.current!.offsetHeight - 48 })); remember(); }
      }}><GripVertical size={17}/></button>
    <div className="palette-content" hidden={collapsed}>{children}</div>
    {collapsed && <button className="palette-reopen" aria-label="Развернуть панель" onClick={() => setCollapsed(false)}><PenLine size={21}/><span>Инструменты</span></button>}
    <button className="palette-collapse icon-button" aria-label={collapsed ? 'Развернуть панель инструментов' : 'Свернуть панель инструментов'} aria-expanded={!collapsed}
      onClick={() => { if (!collapsed) onCollapse(); setCollapsed(!collapsed); }}>
      {collapsed ? <ChevronUp size={17}/> : <ChevronDown size={17}/>}
    </button>
  </div>;
}
