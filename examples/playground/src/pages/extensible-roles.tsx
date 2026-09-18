import { component } from 'sigx';
import type { PageEntry } from './registry';

const ExtensibleRolesDemos = component(() => () => (
    <>
        <p>
            The <code>brand</code> role below is in no built-in vocabulary —
            a scoped theme declares it (<code>scripts/gen-brand-theme.mjs</code>,
            compiled by zero-kit like any design system).
        </p>
        <div
            data-theme="brand"
            style={{
                padding: '1rem',
                borderRadius: 'var(--radius-box)',
                background: 'var(--color-base-100)',
                color: 'var(--color-base-content)',
            }}
        >
            <span
                style={{
                    background: 'var(--color-brand)',
                    color: 'var(--color-brand-content)',
                    boxShadow: '0 0 14px var(--brand-glow)',
                    padding: '0.25rem 0.75rem',
                    borderRadius: 'var(--radius-selector)',
                }}
            >
                brand
            </span>
            {' '}
            <span
                style={{
                    background: 'var(--color-brand-soft)',
                    padding: '0.25rem 0.75rem',
                    borderRadius: 'var(--radius-selector)',
                }}
            >
                brand-soft (derived)
            </span>
        </div>
    </>
), { name: 'ExtensibleRolesDemos' });

export const extensibleRolesPage: PageEntry = {
    id: 'extensible-roles',
    title: 'Extensible roles',
    category: 'Concepts',
    Demos: ExtensibleRolesDemos,
};
