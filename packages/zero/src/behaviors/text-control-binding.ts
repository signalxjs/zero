/**
 * The seam a text control offers to an ancestor that drives it — a
 * trigger-mode Combobox (#58) turning the `Textarea.Textarea` inside it into
 * the combobox's control.
 *
 * The ancestor provides a binding; the control CLAIMS it at setup (the first
 * control to ask wins, so a second textarea nested somewhere below — inside
 * an option, say — stays an ordinary textarea), then renders the claim's
 * attributes over its own, lets the claim see each key before the app's
 * handler, and reports every change of text or caret. Everything the
 * ancestor needs from the element arrives through `setElement`, at mount.
 */
import { defineInjectable } from 'sigx';

export interface TextControlClaim {
    /** ARIA the ancestor owns on the control — rendered over the app's own. */
    attrs(): Record<string, string | undefined>;
    /**
     * Runs before the app's `onKeydown`. `true` means the key was the
     * ancestor's (an option committed, the popup closed) and the app's
     * handler does not run — a composer's Enter-to-send must not also fire
     * when Enter picked a mention.
     */
    keydown(e: KeyboardEvent): boolean;
    /**
     * The text or the caret may have moved: after input (`edited`, and the
     * model already has the value), keyup and click.
     */
    sync(edited?: boolean): void;
    blur(e: FocusEvent): void;
    setElement(el: HTMLTextAreaElement | HTMLInputElement | null): void;
    release(): void;
}

export interface TextControlBinding {
    /** The claim, or `null` when another control already holds it. */
    claim(): TextControlClaim | null;
}

export const useTextControlBinding = defineInjectable<TextControlBinding | null>(() => null);
