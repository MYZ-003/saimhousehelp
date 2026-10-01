/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#2B211B',
    tint: '#C6530A',
    background: '#FFF9F4',
    foreground: '#2B211B',
    card: '#FFFFFF',
    cardForeground: '#2B211B',
    primary: '#B94B08',
    primaryForeground: '#FFFFFF',
    secondary: '#F7ECE2',
    secondaryForeground: '#4A3021',
    muted: '#F4EEE8',
    mutedForeground: '#75665C',
    accent: '#FFE3CF',
    accentForeground: '#793500',
    destructive: '#B42318',
    destructiveForeground: '#FFFFFF',
    border: '#E8DBD1',
    input: '#D8C8BC',
  },
  dark: {
    text: '#F8F0E9',
    tint: '#FF9A5B',
    background: '#18110D',
    foreground: '#F8F0E9',
    card: '#241A13',
    cardForeground: '#F8F0E9',
    primary: '#FF9A5B',
    primaryForeground: '#29180F',
    secondary: '#34261C',
    secondaryForeground: '#F8EADD',
    muted: '#2B2019',
    mutedForeground: '#C4AEA0',
    accent: '#3B281B',
    accentForeground: '#FFD6B5',
    destructive: '#F87171',
    destructiveForeground: '#32090B',
    border: '#48372C',
    input: '#4A3A2E',
  },
  radius: 10,
};

export default colors;
