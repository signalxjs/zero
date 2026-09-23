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

/**
 * Ten thousand options for the windowed (`virtual`) Select and Combobox
 * demos: "Station 1" … "Station 9999", then "Zulu" — the one option a typed
 * Z reaches, at the far end of the list.
 */
export const STATIONS: ReadonlyArray<{ value: string; label: string }> = Array.from(
    { length: 10_000 },
    (_, i) => (i === 9_999 ? { value: 'zulu', label: 'Zulu' } : { value: `s${i + 1}`, label: `Station ${i + 1}` }),
);

/**
 * The same ten thousand stations on forty lines of 250 — the windowed
 * grouped demos (#127): "Line 1" … "Line 40", each a `group`.
 */
export const STATIONS_BY_LINE: ReadonlyArray<{ value: string; label: string; group: string }> = STATIONS.map(
    (station, i) => ({ ...station, group: `Line ${Math.floor(i / 250) + 1}` }),
);
