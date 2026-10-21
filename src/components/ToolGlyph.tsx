export function ToolGlyph({ type }: { type: 'regular' | 'ballpoint' | 'fountain' | 'partial' | 'stroke' }) {
  return <svg width="30" height="34" viewBox="0 0 32 38" fill="none" aria-hidden>
    {type === 'fountain' ? <><path d="M10 5h12l4 16-10 13L6 21 10 5Z" stroke="currentColor" strokeWidth="1.7"/><path d="M16 18v16M10 10h12" stroke="currentColor" strokeWidth="1.7"/><circle cx="16" cy="17" r="2" fill="currentColor"/></>
      : type === 'ballpoint' ? <><path d="M11 4h10v20l-5 10-5-10V4Z" stroke="currentColor" strokeWidth="1.7"/><path d="M11 23h10M16 28v6M20 7h4v14" stroke="currentColor" strokeWidth="1.7"/><path d="M13 5h6v16h-6z" fill="currentColor" opacity=".12"/></>
      : type === 'regular' ? <><path d="M11 4h10v19l-5 11-5-11V4Z" stroke="currentColor" strokeWidth="1.7"/><path d="M11 22h10M14 29h4M14 4v18" stroke="currentColor" strokeWidth="1.5"/></>
      : <><path d="m7 23 12-16a3 3 0 0 1 4 0l5 4a3 3 0 0 1 0 4L16 31H9l-4-4a3 3 0 0 1 2-4Z" stroke="currentColor" strokeWidth="1.7"/><path d="m12 17 11 9" stroke="currentColor" strokeWidth="1.5"/>{type === 'partial' ? <path d="M4 35h8m4 0h4m4 0h4" stroke="currentColor" strokeWidth="1.7"/> : <path d="M4 35h24" stroke="currentColor" strokeWidth="1.7"/>}</>}
  </svg>;
}
