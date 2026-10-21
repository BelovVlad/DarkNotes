import type { NotePage } from '../model';
export class History {
  past: NotePage[][]=[];
  future: NotePage[][]=[];
  push(pages: NotePage[]) { this.past.push(structuredClone(pages));if(this.past.length>80)this.past.shift();this.future=[]; }
  undo(current:NotePage[]) {const previous=this.past.pop();if(!previous)return null;this.future.push(structuredClone(current));return previous;}
  redo(current:NotePage[]) {const next=this.future.pop();if(!next)return null;this.past.push(structuredClone(current));return next;}
}
export const histories=new Map<string,History>();
