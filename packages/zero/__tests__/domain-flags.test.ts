/**
 * Domain flags (#457) — the ecosystem's own presence-only facts, rendered
 * under the fixed `data-x-` namespace. `domainFlagAttrs` is the runtime half;
 * `expectAnatomy` (expect-anatomy.test.ts) and the kit's `mergeManifests`
 * (manifest-merge.test.ts) hold the declaration.
 */
import { describe, it, expect } from 'vitest';
import { DOMAIN_FLAG_PREFIX, domainFlagAttrs, domainFlagKey } from '@sigx/zero';
import { domainFlagAttrs as fromCore } from '@sigx/zero/contract/core';

describe('domainFlagAttrs', () => {
    it('renders a truthy flag as presence and a falsy one as absent', () => {
        expect(domainFlagAttrs({ unread: true, optional: false, flagged: undefined, pinned: 1, archived: 0 })).toEqual({
            'data-x-unread': '',
            'data-x-optional': undefined,
            'data-x-flagged': undefined,
            'data-x-pinned': '',
            'data-x-archived': undefined,
        });
    });

    it('never spells a flag "false"', () => {
        expect(Object.values(domainFlagAttrs({ unread: false }))).not.toContain('false');
    });

    it('throws on a name that could not be an attribute', () => {
        expect(() => domainFlagAttrs({ hasAttachment: true })).toThrow(/"hasAttachment" is not a kebab-case identifier — it becomes the attribute name data-x-hasAttachment/);
        expect(() => domainFlagAttrs({ 'Not Kebab': false })).toThrow(/kebab-case/);
    });

    it('builds the attribute from the namespace and the key from the name', () => {
        expect(DOMAIN_FLAG_PREFIX).toBe('data-x-');
        expect(domainFlagKey('unread')).toBe('x-unread');
        expect(Object.keys(domainFlagAttrs({ 'has-attachment': true }))).toEqual([`data-${domainFlagKey('has-attachment')}`]);
    });

    it('is on the DOM-free contract entry', () => {
        expect(fromCore).toBe(domainFlagAttrs);
    });
});
