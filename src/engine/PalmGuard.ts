/** Share pen priority across every page and the space between pages. */
export class PalmGuard {
  private pens=new Set<number>();
  private penUntil=0;
  private touches=new Map<number,EventTarget>();
  private blocked=new Set<number>();
  private cancelling=false;
  private events=['pointerdown','pointermove','pointerup','pointercancel'] as const;

  constructor(private surface:HTMLElement,private stopNavigation:()=>void){
    for(const type of this.events)surface.ownerDocument.addEventListener(type,this.pointer,{capture:true,passive:false});
  }

  private cancelTouches(){
    if(!this.touches.size)return;
    this.stopNavigation();
    this.cancelling=true;
    try {
      for(const [id,target] of this.touches){
        this.blocked.add(id);
        target.dispatchEvent(new PointerEvent('pointercancel',{pointerId:id,pointerType:'touch',bubbles:true}));
      }
    } finally {this.cancelling=false;this.touches.clear();}
  }

  private pointer=(e:PointerEvent)=>{
    if(this.cancelling)return;
    if(!(e.target instanceof Node&&this.surface.contains(e.target))&&!this.touches.has(e.pointerId)&&!this.blocked.has(e.pointerId)&&!this.pens.has(e.pointerId))return;
    const ending=e.type==='pointerup'||e.type==='pointercancel';
    if(e.pointerType==='pen'){
      // Include hover and the brief lifts between letters, not just pen contact.
      this.penUntil=performance.now()+800;
      if(e.type==='pointerdown'){this.pens.add(e.pointerId);this.stopNavigation();}
      if(ending)this.pens.delete(e.pointerId);
      this.cancelTouches();
      return;
    }
    if(e.pointerType!=='touch')return;
    const broadContact=Math.max(e.width,e.height)>=40||Math.min(e.width,e.height)>=28;
    if(this.blocked.has(e.pointerId)||this.pens.size||performance.now()<this.penUntil||broadContact){
      // Once rejected, a resting palm stays rejected until it leaves the screen.
      if(this.touches.has(e.pointerId))this.cancelTouches();
      this.blocked.add(e.pointerId);
      e.preventDefault();e.stopImmediatePropagation();
      if(ending){this.blocked.delete(e.pointerId);this.touches.delete(e.pointerId);}
      return;
    }
    if(e.type==='pointerdown'&&e.target)this.touches.set(e.pointerId,e.target);
    if(ending)this.touches.delete(e.pointerId);
  };

  dispose(){for(const type of this.events)this.surface.ownerDocument.removeEventListener(type,this.pointer,true);}
}
