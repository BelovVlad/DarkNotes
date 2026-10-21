import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/** Portaling avoids clipping/containing blocks created by the glass palette. */
export function ToolPopover({ anchor, children, onClose }: {
  anchor: RefObject<HTMLDivElement | null>; children: ReactNode; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 12, top: 56 });
  useLayoutEffect(() => {
    const place = () => {
      const menu = ref.current!, rect = anchor.current!.getBoundingClientRect();
      const left = Math.max(12, Math.min(rect.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 12));
      const below = rect.bottom + 10;
      const top = below + menu.offsetHeight <= window.innerHeight - 12 ? below : Math.max(56, rect.top - menu.offsetHeight - 10);
      setPosition({ left, top });
    };
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node) && !anchor.current?.contains(event.target as Node)) onClose();
    };
    place(); window.addEventListener('resize', place); document.addEventListener('pointerdown', outside);
    return () => { window.removeEventListener('resize', place); document.removeEventListener('pointerdown', outside); };
  }, [anchor, onClose]);
  return createPortal(<div ref={ref} className="dropdown tool-popover" style={position} role="region" aria-label="Дополнительные инструменты">{children}</div>, document.body);
}
