import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, SyntheticEvent } from 'react';
import { matchingSymbols, symbolTrigger } from './answer-symbols.ts';
import type { AnswerSymbol } from './answer-symbols.ts';
import { moduleInfo } from './content/index.ts';

type TextField = HTMLInputElement | HTMLTextAreaElement;

export function SymbolInput({ id, value, setValue, rows, numeric = false, disabled, maxLength, placeholder }: {
  id: string; value: string; setValue: (value: string) => void; rows?: number; numeric?: boolean;
  disabled?: boolean; maxLength: number; placeholder?: string;
}) {
  const field = useRef<TextField | null>(null);
  const pendingCaret = useRef<number | null>(null);
  const listId = useId();
  const [trigger, setTrigger] = useState<ReturnType<typeof symbolTrigger>>(null);
  const [index, setIndex] = useState(0);
  const open = !disabled && trigger !== null;
  const matches = open ? matchingSymbols(moduleInfo.id, numeric, trigger.query) : [];
  const optionId = (i: number) => listId + '-' + i;
  const close = () => setTrigger(null);

  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    field.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [value, trigger]);

  function insert(symbol: AnswerSymbol) {
    if (!trigger || !field.current) return;
    const text = symbol.insert ?? symbol.glyph;
    const updated = value.slice(0, trigger.start) + text + value.slice(trigger.end);
    if (updated.length > maxLength) return;
    pendingCaret.current = trigger.start + text.length;
    field.current.focus({ preventScroll: true });
    setValue(updated);
    close();
  }

  function change(event: ChangeEvent<TextField>) {
    const target = event.currentTarget;
    setValue(target.value);
    setTrigger(symbolTrigger(target.value, target.selectionStart ?? 0, target.selectionEnd ?? 0));
    setIndex(0);
  }

  function keyDown(event: KeyboardEvent<TextField>) {
    if (!open || event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (matches.length && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
      setIndex(next);
      document.getElementById(optionId(next))?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && matches[index]) {
      event.preventDefault();
      insert(matches[index]);
    }
  }

  const control = {
    id, value, disabled, maxLength, placeholder, onChange: change, onKeyDown: keyDown,
    onSelect: (event: SyntheticEvent<TextField>) => {
      const { selectionStart, selectionEnd } = event.currentTarget;
      if (trigger && (selectionEnd !== trigger.end || (trigger.query && selectionStart !== selectionEnd))) close();
    },
    ref: (element: TextField | null) => { field.current = element; },
    'aria-autocomplete': 'list' as const,
    'aria-controls': open && matches.length ? listId : undefined,
    'aria-activedescendant': open && matches[index] ? optionId(index) : undefined,
  };

  return <div className="symbol-input" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) close();
  }}>
    {rows ? <textarea {...control} rows={rows} /> : <input {...control} autoComplete="off" />}
    {!disabled && <button className="text-button symbol-trigger" type="button" aria-label="Insert symbol"
      aria-expanded={open} aria-controls={open && matches.length ? listId : undefined}
      title="Type # to find a symbol" onClick={() => {
        if (open) { close(); return; }
        const start = field.current?.selectionStart ?? value.length;
        const end = field.current?.selectionEnd ?? start;
        setTrigger({ start, end, query: '' });
        setIndex(0);
        field.current?.focus({ preventScroll: true });
      }}># Symbols</button>}
    {open && <div className="symbol-menu">
      {matches.length ? <ul id={listId} role="listbox" aria-label="Insert a symbol">{matches.map((symbol, i) =>
        <li key={symbol.glyph} id={optionId(i)} role="option" aria-selected={index === i}
          onMouseDown={event => event.preventDefault()} onClick={() => insert(symbol)}>
          <strong>{symbol.glyph}</strong><span>{symbol.name}</span>
        </li>)}</ul> : <small role="status">No matching symbols</small>}
    </div>}
  </div>;
}
