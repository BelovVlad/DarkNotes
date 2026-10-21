import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Copy, MoreHorizontal, Move, Pencil, Trash2 } from 'lucide-react';
import { covers, type NoteDocument } from '../model';

export function FileMenu({ document: doc, open, onOpenChange, onRename, onDuplicate, onMove, onPurge, onUpdate }: {
  document: NoteDocument; open: boolean; onOpenChange: (open: boolean) => void;
  onRename: () => void; onDuplicate: () => void; onMove: () => void; onPurge: () => void;
  onUpdate: (doc: NoteDocument) => void;
}) {
  return <DropdownMenu.Root open={open} onOpenChange={onOpenChange} modal={false}>
    <DropdownMenu.Trigger asChild><button className="icon-button" aria-label={`Действия: ${doc.title}`} title={`Действия: ${doc.title}`}><MoreHorizontal size={19}/></button></DropdownMenu.Trigger>
    <DropdownMenu.Portal><DropdownMenu.Content className="file-menu" align="end" sideOffset={6} collisionPadding={12}>
      <DropdownMenu.Label className="file-menu-label">{doc.title || 'Без названия'}</DropdownMenu.Label>
      {doc.deleted ? <>
        <DropdownMenu.Item onSelect={() => onUpdate({ ...doc, deleted: null })}>Восстановить</DropdownMenu.Item>
        <DropdownMenu.Item className="danger-text" onSelect={onPurge}>Удалить навсегда</DropdownMenu.Item>
      </> : <>
        <DropdownMenu.Item onSelect={onRename}><Pencil size={15}/>Переименовать</DropdownMenu.Item>
        <DropdownMenu.Item onSelect={onDuplicate}><Copy size={15}/>Дублировать</DropdownMenu.Item>
        <DropdownMenu.Item onSelect={onMove}><Move size={15}/>Переместить</DropdownMenu.Item>
        <DropdownMenu.Sub><DropdownMenu.SubTrigger>Цвет обложки<span aria-hidden>›</span></DropdownMenu.SubTrigger>
          <DropdownMenu.Portal><DropdownMenu.SubContent className="file-menu" sideOffset={5} collisionPadding={12}>
            <DropdownMenu.RadioGroup value={doc.color} onValueChange={color => onUpdate({ ...doc, color })}>
              {covers.map((color, index) => <DropdownMenu.RadioItem key={color} value={color}>
                <span className="file-color" style={{ background: color }}/>{['Песочный', 'Шалфей', 'Серый синий', 'Терракота', 'Лаванда', 'Оливковый', 'Морской', 'Графит'][index]}
                <DropdownMenu.ItemIndicator>✓</DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>)}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.SubContent></DropdownMenu.Portal>
        </DropdownMenu.Sub>
        <DropdownMenu.Separator className="file-menu-separator"/>
        <DropdownMenu.Item className="danger-text" onSelect={() => onUpdate({ ...doc, deleted: Date.now() })}><Trash2 size={15}/>В корзину</DropdownMenu.Item>
      </>}
    </DropdownMenu.Content></DropdownMenu.Portal>
  </DropdownMenu.Root>;
}
