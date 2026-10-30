// Preserve the three supported themes; other legacy palettes use Night.
export const normalizeTheme = value => ['light','charcoal-dark'].includes(value) ? value : 'pitch-black';
