/**
 * The text-control surface (#40) against the REAL parts: the native events
 * are typed on `Input.Input` / `Textarea.Textarea`, the `ref` receives the
 * handle, and `id` stays the form contract's.
 */
import { Input, Textarea } from '@sigx/zero';
import type { InputHandle, TextareaHandle } from '@sigx/zero';

let textarea: TextareaHandle | null = null;
let input: InputHandle | null = null;

// ── valid ──
export const composer = (
    <Textarea.Textarea
        role="combobox" aria-expanded={false} aria-controls="list"
        onKeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) e.preventDefault(); }}
        onInput={(e) => e.target}
        onCompositionend={(e) => e.data}
        onBeforeinput={(e) => e.inputType}
        ref={(h) => { textarea = h; }}
    />
);
export const search = <Input.Input onKeyup={(e) => e.key} onFocus={(e) => e.relatedTarget} ref={(h) => { input = h; }} />;
export const caret = () => textarea?.element?.setSelectionRange(0, 0) ?? input?.focus();

// ── invalid ──
// @ts-expect-error — the control's id is the Field's and the Label's
export const e1 = <Textarea.Textarea id="mine" />;
// @ts-expect-error — onKeydown receives a KeyboardEvent
export const e2 = <Input.Input onKeydown={(e: MouseEvent) => e.button} />;
// @ts-expect-error — the handle's element is a textarea
export const e3 = <Textarea.Textarea ref={(h: { element: HTMLInputElement | null } | null) => h} />;
