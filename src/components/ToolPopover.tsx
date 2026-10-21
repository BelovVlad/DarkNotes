import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

type Side = 'top' | 'bottom' | 'left' | 'right';
/** Portals escape the palette's glass layer; observers keep the panel attached. */
export function ToolPopover({ anchor, children, onClose, placement = 'bottom', className = 'tool-popover', label = 'Дополнительные инструменты' }: {
  anchor: RefObject<HTMLDivElement | null>; children: ReactNode; onClose: () => void; placement?: Side; className?: string; label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 12, top: 56 });
  useLayoutEffect(() => {
    const place = () => {
      const menu = ref.current, element = anchor.current; if (!menu || !element) return;
      const rect = element.getBoundingClientRect(), width = menu.offsetWidth, height = menu.offsetHeight;
      const minTop = document.querySelector('.editor-shell')?.classList.contains('header-hidden') || document.querySelector('.writing-focus') ? 8 : 56;
      const candidates = {
        bottom: { left: rect.left + (rect.width - width) / 2, top: rect.bottom + 10 },
        top: { left: rect.left + (rect.width - width) / 2, top: rect.top - height - 10 },
        right: { left: rect.right + 10, top: rect.top + (rect.height - height) / 2 },
        left: { left: rect.left - width - 10, top: rect.top + (rect.height - height) / 2 },
      };
      const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const;
      const order: Side[] = [placement, opposite[placement], 'bottom', 'top', 'right', 'left'];
      const fits = (side: Side) => { const p = candidates[side]; return p.left >= 12 && p.left + width <= window.innerWidth - 12 && p.top >= minTop && p.top + height <= window.innerHeight - 12; };
      const chosen = order.find(fits) || placement, point = candidates[chosen];
      const next = { left: Math.max(12, Math.min(point.left, window.innerWidth - width - 12)), top: Math.max(minTop, Math.min(point.top, window.innerHeight - height - 12)) };
      setPosition(previous => previous.left === next.left && previous.top === next.top ? previous : next);
    };
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node) && !anchor.current?.contains(event.target as Node)) onClose();
    };
    place();
    const size = new ResizeObserver(place); size.observe(ref.current!); size.observe(anchor.current!);
    const movement = new MutationObserver(place); movement.observe(anchor.current!, { attributes: true, attributeFilter: ['style', 'data-edge'] });
    window.addEventListener('resize', place); document.addEventListener('pointerdown', outside);
    return () => { size.disconnect(); movement.disconnect(); window.removeEventListener('resize', place); document.removeEventListener('pointerdown', outside); };
  }, [anchor, onClose, placement]);
  return createPortal(<div ref={ref} className={`dropdown ${className}`} style={position} role="region" aria-label={label}>{children}</div>, document.body);
}
