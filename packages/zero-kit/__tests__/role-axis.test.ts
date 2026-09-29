/**
 * `RoleDecl.axis` (#425): whether a role is a `color` axis value is an
 * explicit declaration, defaulting to the token-shape inference `isFillRole`
 * made before the field existed (#286). One predicate, read by the skins
 * (`axisRoles`), the value-coverage guard and the score — so the tests pin
 * the predicate and that the guard shares it, not each consumer separately.
 */
import { describe, it, expect } from 'vitest';
import { axisRoles, defineTokens, isFillRole, validateDesignSystem } from '@sigx/zero-kit';
import type { ManifestComponent, RoleDecl } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { roles as materialRoles } from '@sigx/zero-material';
import { isFillOrHairline } from '../src/audit/index.js';

const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };

describe('RoleDecl.axis', () => {
    it('defaults to the token-shape inference', () => {
        expect(isFillRole(undefined)).toBe(false);
        expect(isFillRole({})).toBe(false);
        expect(isFillRole({ soft: false })).toBe(true);
        expect(isFillRole({ content: false })).toBe(true);
        expect(isFillRole({ content: false, soft: false })).toBe(true);
    });

    it('overrides the inference both ways when declared', () => {
        // A fill with an ink AND a soft tint — the shape M3's containers
        // could not express before: off the axis without opting out of -soft.
        expect(isFillRole({ axis: false })).toBe(true);
        // An action role with no mixed tint — still an axis value.
        expect(isFillRole({ axis: true, soft: false })).toBe(false);
    });

    it('is the one predicate axisRoles and the value-coverage guard read', () => {
        const roles: Record<string, RoleDecl> = {
            primary: {},
            flat: { soft: false, axis: true },
            container: { axis: false },
            surface: { soft: false },
            outline: { content: false, soft: false },
        };
        expect(axisRoles(roles)).toEqual(['primary', 'flat']);
        for (const decl of Object.values(roles)) expect(isFillOrHairline(decl)).toBe(isFillRole(decl));
    });

    it('rejects an axis value with no -content ink', () => {
        const tokens = (outline: RoleDecl) => defineTokens({
            roles: { primary: {}, outline },
            themes: {
                day: {
                    colorScheme: 'light',
                    colors: {
                        'base-100': 'white', 'base-200': 'white', 'base-300': 'white', 'base-content': 'black',
                        primary: '#1d4ed8', 'primary-content': 'white', outline: 'gray', 'outline-content': 'black',
                    },
                },
            },
            defaultLight: 'day',
        });
        const says = (decl: RoleDecl) => validateDesignSystem({ name: 'x', tokens: tokens(decl), recipes: [] }, manifest)
            .errors.some((e) => e.message.includes('"outline" is declared `axis: true` with `content: false`'));
        expect(says({ axis: true, content: false })).toBe(true);
        expect(says({ axis: false, content: false })).toBe(false);
        expect(says({ content: false })).toBe(false);
    });

    it('zero-material says off-axis explicitly rather than through soft: false', () => {
        // The #425 workaround was `soft: false` standing in for "not an axis
        // value". Every material role off the axis now declares it.
        for (const [name, decl] of Object.entries(materialRoles) as [string, RoleDecl][]) {
            if (isFillRole(decl)) expect(decl.axis, name).toBe(false);
        }
        expect(axisRoles(materialRoles)).toEqual(
            ['primary', 'secondary', 'tertiary', 'error', 'neutral', 'info', 'success', 'warning'],
        );
    });
});
