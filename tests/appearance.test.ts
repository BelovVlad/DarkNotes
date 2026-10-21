import { describe, expect, it } from 'vitest';
import { DARK_PAPER, inkColor, inkPairs, isDark, themedPage } from '../src/appearance';
import { blankPage } from '../src/model';

describe('theme-aware paper and ink',()=>{
 it('adapts old default pages without changing saved contents',()=>{const page=blankPage({paperColor:'#faf8f3'});expect(themedPage(page,true).paperColor).toBe(DARK_PAPER);expect(themedPage(page,false).paperColor).toBe('#ffffff');expect(page.paperColor).toBe('#faf8f3');});
 it('respects an explicitly chosen paper colour',()=>{const page=blankPage({paperColor:'#faf8f3',paperTheme:'custom'});expect(themedPage(page,true)).toBe(page);});
 it('uses the same palette roles in either direction',()=>{for(const [light,dark] of inkPairs){expect(inkColor(light,true)).toBe(dark);expect(inkColor(dark,false)).toBe(light);expect(isDark(light)).toBe(true);expect(isDark(dark)).toBe(false);}});
 it('maps neutral legacy ink while preserving custom chromatic colours',()=>{expect(inkColor('#000',true)).toBe('#ead4b7');expect(inkColor('#ffffff',false)).toBe('#252b28');expect(inkColor('#123456',false)).toBe('#123456');expect(inkColor('#123456')).toBe('#123456');});
});
