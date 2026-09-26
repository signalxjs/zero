/**
 * The tri-state derivation a box that stands for a SET of values shares:
 * CheckboxGroup's `parent` box over the group's `allValues`, and a checkable
 * TreeView branch over its enabled descendant leaves. The state is derived,
 * never stored — `checked` when every member is in the selection,
 * `unchecked` when none is, `indeterminate` when some are — and a toggle
 * selects all of the members or none of them.
 */
export type TriState = 'checked' | 'unchecked' | 'indeterminate';

/**
 * How many of `members` `selected` holds, as a tri-state. An empty member set
 * is `unchecked`: there is nothing to have checked.
 */
export function triState(members: readonly string[], selected: readonly string[]): TriState {
    if (members.length === 0) return 'unchecked';
    const count = members.filter((v) => selected.includes(v)).length;
    return count === 0 ? 'unchecked' : count === members.length ? 'checked' : 'indeterminate';
}

/**
 * The selection after toggling `members` together: all of them out when all
 * were in, else every missing one in (appended, in `members` order). Values
 * outside `members` are left exactly where they were.
 */
export function toggleTriState(members: readonly string[], selected: readonly string[]): string[] {
    return triState(members, selected) === 'checked'
        ? selected.filter((v) => !members.includes(v))
        : [...selected, ...members.filter((v) => !selected.includes(v))];
}
