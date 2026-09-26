/**
 * Field — the wiring hub for a labeled form control.
 *
 * ```tsx
 * <Field.Root invalid={!!error}>
 *     <Field.Label>Email</Field.Label>
 *     <Checkbox.Root>Subscribe</Checkbox.Root>
 *     <Field.Description>We never spam.</Field.Description>
 *     {error && <Field.Error>{error}</Field.Error>}
 * </Field.Root>
 * ```
 *
 * Any zero form control inside adopts the field's control id, disabled/
 * invalid/required flags and `aria-describedby` automatically — and its
 * `size`, when the control sets none of its own, so a compact field is
 * `<Field.Root size="xs">` rather than a size on every part.
 *
 * Validation (#284) is the platform's constraint API, surfaced:
 *
 * ```tsx
 * <form>
 *     <Field.Root validate={(v) => (v === 'admin' ? 'That name is taken.' : null)} validateOn="blur">
 *         <Field.Label>Username</Field.Label>
 *         <Input.Root name="user" required minlength={3}>…</Input.Root>
 *         <Field.Error match="valueMissing">Pick a username.</Field.Error>
 *         <Field.Error match="tooShort">At least three characters.</Field.Error>
 *         <Field.Error match="custom" />
 *     </Field.Root>
 * </form>
 * ```
 *
 * The control reports the element constraint validation runs on (its own,
 * or the hidden `<select>`/`<input>` it posts through). `validate`'s message
 * is pushed through `setCustomValidity`, so native submission blocks on it;
 * what the Field SHOWS moves on `validateOn` — the first failed submit (the
 * default), leaving the field, or every change — and after a failed submit,
 * on every change. A Field that renders a `Field.Error` cancels the native
 * bubble (the Error says it) and focuses the first invalid control itself.
 */
import { component, compound, defineInjectable, defineProvide, effect, watch } from 'sigx';
import type { Define } from 'sigx';
import { createId } from '../../behaviors/create-id.js';
import { onFormReset } from '../../behaviors/form-reset.js';
import { mountScope } from '../../behaviors/mount-scope.js';
import { countPresence, reportPresence, settleAfterMount } from '../../behaviors/part-presence.js';
import {
    provideFieldContext,
    useFieldContext,
    type FieldContext,
    type FieldValidity,
    type FieldValidityReport,
    type ValidityKey,
} from '../../behaviors/field.js';
import { dataAttr } from '../../contract/data-attrs.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { WithClass, WithDisabled, WithHtmlAttrs, WithInvalid, WithReadonly, WithRequired, WithVariantAxes, WithVisuallyHidden } from '../../contract/props.js';
import { fieldAnatomy } from './anatomy.js';

const SCOPE = fieldAnatomy.scope;

/** When the Field shows its validity: the first failed submit, leaving the field, or every change. */
export type FieldValidateOn = 'submit' | 'blur' | 'change';

/**
 * A synchronous check over the control's value and its native validity (a
 * copy taken with no custom message set). A message — or several — makes
 * the field invalid and blocks native submission; `null` (or `[]`) passes.
 * Async and schema orchestration stay the app's: set `invalid` from it.
 */
export type FieldValidate = (value: unknown, validity: FieldValidity) => string | readonly string[] | null | undefined;

const VALIDITY_KEYS: readonly ValidityKey[] = [
    'badInput', 'customError', 'patternMismatch', 'rangeOverflow', 'rangeUnderflow',
    'stepMismatch', 'tooLong', 'tooShort', 'typeMismatch', 'valid', 'valueMissing',
];

const VALID: FieldValidity = Object.freeze(
    Object.fromEntries(VALIDITY_KEYS.map((k) => [k, k === 'valid'])) as Record<ValidityKey, boolean>,
);

function copyValidity(v: FieldValidity): FieldValidity {
    return Object.fromEntries(VALIDITY_KEYS.map((k) => [k, !!v[k]])) as Record<ValidityKey, boolean>;
}

/** What a Field shows: the snapshot taken at its last validation. */
interface Shown {
    validity: FieldValidity;
    /** The platform's own message, taken before the custom one was set. */
    native: string;
    /** `validate`'s messages. */
    custom: string[];
}

// ── Focus after a failed submit ──
//
// The platform focuses the first invalid control only among those whose
// `invalid` event was NOT cancelled, so a Field that cancels it (to show
// its Error instead of the bubble) must focus in its place — the FIRST
// invalid control in the form's order, once per submit, not whichever Field
// heard its event last. Client-only state, like the dismiss layer stack:
// entries exist only between mount and unmount.

interface FocusEntry {
    root(): HTMLElement | null;
    /** Whether this Field cancels the bubble (renders a Field.Error). */
    handles(): boolean;
    focus(): void;
}

const focusEntries = new Set<FocusEntry>();
const pendingFocus = new Set<object>();

/** Anything constraint validation runs on, as `form.elements` yields it. */
type Validatable = Element & { willValidate?: boolean; validity?: { valid: boolean } };

function scheduleFocus(form: HTMLFormElement | null, own: FocusEntry): void {
    const key: object = form ?? own;
    if (pendingFocus.has(key)) return;
    pendingFocus.add(key);
    // A microtask: when the platform dispatches `invalid` from a user's
    // submit, the checkpoint runs right after this listener — before the
    // platform focuses an unhandled control, which then wins, as it should
    // when it comes first. Validity is live state, so the controls whose
    // events have not fired yet already read invalid.
    queueMicrotask(() => {
        pendingFocus.delete(key);
        if (!form) {
            own.focus();
            return;
        }
        const first = Array.from(form.elements as ArrayLike<Validatable>)
            .find((el) => el.willValidate !== false && el.validity && !el.validity.valid);
        if (!first) return;
        for (const entry of focusEntries) {
            const root = entry.root();
            if (root && root.contains(first)) {
                if (entry.handles()) entry.focus();
                return;
            }
        }
    });
}

export type FieldRootProps =
    & WithDisabled
    & WithInvalid
    & WithRequired
    & WithReadonly
    /**
     * A synchronous check run with the native constraints (#284) — its
     * message goes through `setCustomValidity`, so a native submit blocks on
     * it, and `Field.Error match="custom"` shows it.
     */
    & Define.Prop<'validate', FieldValidate, false>
    /** When the Field shows its validity (default `submit`). After a failed submit, every change revalidates. */
    & Define.Prop<'validateOn', FieldValidateOn, false>
    & WithVariantAxes<'field'>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const FieldRoot = component<FieldRootProps>(({ props, slots, signal, onMounted, onUnmounted }) => {
    const baseId = createId('zx-field');
    // Reported by Field.Description and Field.Error (`reportPresence`), so a
    // control's `aria-describedby` names only what is rendered and never
    // dangles — optimistic until settled after mount, so server markup (and
    // the hydrating first render) keeps both ids.
    const present = signal<{ description: number; errors: Record<string, number>; settled: boolean }>({
        description: 0,
        errors: {},
        settled: false,
    });
    settleAfterMount(onMounted, () => { present.settled = true; });
    const ids = {
        control: `${baseId}-control`,
        label: `${baseId}-label`,
        description: `${baseId}-desc`,
        error: `${baseId}-error`,
    };

    // ── Validation (#284) ──
    // `shown` moves only when the Field validates for display; the element's
    // custom validity is kept current on every change regardless, so a
    // native submit always blocks on what `validate` says NOW.
    const v = signal<{ validated: boolean; submitted: boolean; shown: Shown; reports: number }>({
        validated: false,
        submitted: false,
        shown: { validity: VALID, native: '', custom: [] },
        reports: 0,
    });
    // Registration order, non-reactive: `reports` above is the signal.
    const reports: FieldValidityReport[] = [];
    const current = (): FieldValidityReport | undefined => reports[0];
    // Mounted Field.Errors, matched or not: whether this Field speaks for
    // the control, so the native bubble is cancelled.
    let errorsMounted = 0;
    let rootEl: HTMLElement | null = null;

    /** Validate now: refresh the custom validity and return what to show. */
    const check = (): Shown => {
        const report = current();
        const el = report?.element() ?? null;
        // A control the platform bars from validation (disabled, readonly)
        // is valid — nothing the user can fix is wrong with it.
        // (`=== false`: a simulated DOM may leave `willValidate` undefined.)
        if (el && el.willValidate === false) return { validity: VALID, native: '', custom: [] };
        let native = VALID;
        let message = '';
        if (el) {
            el.setCustomValidity('');
            native = copyValidity(el.validity);
            message = el.validationMessage;
        }
        const out = props.validate?.(report?.value(), native);
        const custom = (out == null ? [] : typeof out === 'string' ? [out] : [...out]).filter((m) => m !== '');
        if (el && custom.length > 0) el.setCustomValidity(custom.join('\n'));
        return {
            validity: { ...native, customError: custom.length > 0, valid: native.valid && custom.length === 0 },
            native: message,
            custom,
        };
    };
    const display = (): void => {
        v.shown = check();
        v.validated = true;
    };
    const invalid = (): boolean => !!props.invalid || (v.validated && !v.shown.validity.valid);

    const ctx: FieldContext = {
        inert: false,
        ids,
        disabled: () => !!props.disabled,
        invalid,
        required: () => !!props.required,
        readonly: () => !!props.readonly,
        size: () => props.size,
        describedBy: () => {
            if (!present.settled) return `${ids.description} ${ids.error}`;
            const errors = Object.keys(present.errors).filter((id) => (present.errors[id] ?? 0) > 0);
            return [present.description > 0 ? ids.description : undefined, ...errors]
                .filter(Boolean).join(' ') || undefined;
        },
        setDescriptionPresent: (p) => { present.description = countPresence(present.description, p); },
        setErrorPresent: (p, id = ids.error) => {
            present.errors = { ...present.errors, [id]: countPresence(present.errors[id] ?? 0, p) };
        },
        report: (report) => {
            reports.push(report);
            v.reports++;
            return () => {
                const i = reports.indexOf(report);
                if (i >= 0) reports.splice(i, 1);
                v.reports++;
            };
        },
    };
    provideFieldContext(ctx);
    // Field.Error's side: the match it shows and whether a bubble is its to cancel.
    provideFieldValidation({
        shown: () => (v.validated ? v.shown : null),
        errorMounted: (mounted) => { errorsMounted += mounted ? 1 : -1; },
    });

    const focusEntry: FocusEntry = {
        root: () => rootEl,
        handles: () => errorsMounted > 0,
        focus: () => current()?.focus(),
    };

    // `invalid` does not bubble, but it captures: one listener on the root
    // hears every control inside — each radio of a group, a hidden select.
    const onInvalid = (e: Event): void => {
        if (!current()) return;
        display();
        v.submitted = true;
        if (errorsMounted > 0) {
            e.preventDefault();
            scheduleFocus((e.target as { form?: HTMLFormElement | null }).form ?? null, focusEntry);
        }
    };
    const onFocusout = (e: FocusEvent): void => {
        if ((props.validateOn ?? 'submit') !== 'blur' || !current()) return;
        const next = e.relatedTarget as Node | null;
        if (next && rootEl?.contains(next)) return;
        display();
    };

    let detachReset = (): void => {};
    let detachListeners = (): void => {};
    const scoped = mountScope();
    onMounted(() => scoped(() => {
        const root = rootEl;
        root?.addEventListener('invalid', onInvalid, true);
        root?.addEventListener('focusout', onFocusout);
        detachListeners = () => {
            root?.removeEventListener('invalid', onInvalid, true);
            root?.removeEventListener('focusout', onFocusout);
        };
        focusEntries.add(focusEntry);
        let first = true;
        effect(() => {
            void v.reports;
            const report = current();
            report?.value();
            const initial = first;
            first = false;
            // A microtask: the element has taken the value by then (a
            // hidden select re-renders from the model).
            queueMicrotask(() => {
                if (!current()) return;
                const mode = props.validateOn ?? 'submit';
                const live = !initial && (mode === 'change' || v.submitted || (v.validated && !v.shown.validity.valid));
                if (live) display();
                else check();
            });
        });
        // Reset forgets what was shown — the form is back where it started.
        const owner = (): { form: HTMLFormElement | null } | null => {
            const el = current()?.element() as { form?: HTMLFormElement | null } | null | undefined;
            return { form: el?.form ?? rootEl?.closest('form') ?? null };
        };
        detachReset = onFormReset(owner, () => {
            v.validated = false;
            v.submitted = false;
            v.shown = { validity: VALID, native: '', custom: [] };
            // After the controls' own restores, scheduled alongside this one.
            setTimeout(() => { if (current()) check(); }, 0);
        });
    }));
    onUnmounted(() => {
        detachListeners();
        focusEntries.delete(focusEntry);
        detachReset();
    });

    return () => (
        <div
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="root"
            data-disabled={dataAttr(props.disabled)}
            data-invalid={dataAttr(invalid())}
            data-required={dataAttr(props.required)}
            data-readonly={dataAttr(props.readonly)}
            {...variantAttrs(props)}
            class={props.class}
            ref={(node: HTMLElement | null) => { rootEl = node; }}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Field.Root' });

/** The Field's validation, as Field.Error reads it — private to this module. */
interface FieldValidation {
    /** What the last validation found — `null` until the Field has validated. */
    shown(): Shown | null;
    errorMounted(mounted: boolean): void;
}

const useFieldValidation = defineInjectable<FieldValidation | null>(() => null);
function provideFieldValidation(validation: FieldValidation): void {
    defineProvide(useFieldValidation, () => validation);
}

export type FieldLabelProps =
    & WithClass
    & WithVisuallyHidden
    /** Not `id`: the control is labelled by the Label's own. */
    & Omit<WithHtmlAttrs, 'id'>
    & Define.Slot<'default'>;

const FieldLabel = component<FieldLabelProps>(({ props, slots }) => {
    const field = useFieldContext();
    return () => (
        <label
            {...htmlAttrs(props)}
            id={field.ids.label}
            for={field.ids.control}
            data-scope={SCOPE}
            data-part="label"
            data-disabled={dataAttr(field.disabled())}
            data-invalid={dataAttr(field.invalid())}
            data-required={dataAttr(field.required())}
            data-visually-hidden={dataAttr(props.visuallyHidden)}
            class={props.class}
        >
            {slots.default?.()}
        </label>
    );
}, { name: 'Field.Label' });

/** Not `id`: the control's `aria-describedby` points at the Description's own. */
export type FieldDescriptionProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const FieldDescription = component<FieldDescriptionProps>(({ props, slots, onUnmounted }) => {
    const field = useFieldContext();
    reportPresence((p) => field.setDescriptionPresent?.(p), onUnmounted);
    return () => (
        <p {...htmlAttrs(props)} id={field.ids.description} data-scope={SCOPE} data-part="description" class={props.class}>
            {slots.default?.()}
        </p>
    );
}, { name: 'Field.Description' });

/** Which failure a Field.Error speaks for: a `ValidityState` key, `validate`'s message, or always. */
export type FieldErrorMatch = ValidityKey | 'custom' | true;

/** Not `id` (the control's `aria-describedby` points at it) nor `role` (an `alert`). */
export type FieldErrorProps =
    & WithClass
    & Omit<WithHtmlAttrs, 'id' | 'role'>
    /**
     * Render only while the Field's last validation found this (#284): a
     * `ValidityState` key (`valueMissing`, `tooShort`, `patternMismatch`, …),
     * `custom` for a `validate` message, or `true` for always — which is also
     * what an Error without `match` does. Without children it renders the
     * message itself: the platform's for a key, `validate`'s for `custom`,
     * every current one otherwise.
     */
    & Define.Prop<'match', FieldErrorMatch, false>
    & Define.Slot<'default'>;

const FieldError = component<FieldErrorProps>(({ props, slots, onUnmounted }) => {
    const field = useFieldContext();
    const validation = useFieldValidation();
    validation?.errorMounted(true);
    onUnmounted(() => validation?.errorMounted(false));

    const match = (): FieldErrorMatch | undefined => props.match;
    const keyed = (): boolean => match() !== undefined && match() !== true;
    // A keyed Error has an id of its own — two may show at once (a missing
    // value AND a `validate` message) and ids must stay unique.
    const id = (): string => (keyed() ? `${field.ids.error}-${String(match())}` : field.ids.error);
    const shows = (): boolean => {
        const m = match();
        if (m === undefined || m === true) return true;
        const shown = validation?.shown();
        if (!shown) return false;
        return m === 'custom' ? shown.custom.length > 0 : !!shown.validity[m];
    };
    const messages = (): string[] => {
        const shown = validation?.shown();
        if (!shown) return [];
        const m = match();
        if (m === 'custom') return shown.custom;
        if (m !== undefined && m !== true) return shown.native ? [shown.native] : [];
        return [...(shown.native ? [shown.native] : []), ...shown.custom];
    };

    if (!keyed()) {
        reportPresence((p) => field.setErrorPresent?.(p, id()), onUnmounted);
    } else {
        // Present only while it shows — deferred like `reportPresence`, and
        // withdrawn under the id it reported, so a changed `match` cannot
        // strand a count.
        let reported: string | null = null;
        let alive = true;
        const sync = (want: boolean): void => {
            queueMicrotask(() => {
                const next = alive && want ? id() : null;
                if (next === reported) return;
                if (reported) field.setErrorPresent?.(false, reported);
                if (next) field.setErrorPresent?.(true, next);
                reported = next;
            });
        };
        watch(shows, sync, { immediate: true });
        onUnmounted(() => {
            alive = false;
            sync(false);
        });
    }

    return () => {
        if (!shows()) return null;
        return (
            <p
                {...htmlAttrs(props)}
                id={id()}
                data-scope={SCOPE}
                data-part="error"
                data-invalid={dataAttr(field.invalid())}
                role="alert"
                class={props.class}
            >
                {slots.default ? slots.default() : messages().join(' ')}
            </p>
        );
    };
}, { name: 'Field.Error' });

export const Field = compound(FieldRoot, {
    Root: FieldRoot,
    Label: FieldLabel,
    Description: FieldDescription,
    Error: FieldError,
});
