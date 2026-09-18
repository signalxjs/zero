/**
 * Demo data shared by more than one page. Single-page data stays in its page.
 */

export const avatarSvg = (hue: number): string =>
    'data:image/svg+xml,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">`
        + `<rect width="80" height="80" fill="oklch(70% 0.15 ${hue})"/>`
        + `<circle cx="40" cy="30" r="14" fill="white"/>`
        + `<path d="M12 78c4-20 52-20 56 0z" fill="white"/></svg>`,
    );
export const AVATAR_A = avatarSvg(250);
export const AVATAR_B = avatarSvg(150);
