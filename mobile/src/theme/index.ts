import { StyleSheet } from 'react-native';

/**
 * Design tokens for the reports screens.
 * Direction: a khata (ledger book) page. Banana-leaf green as the base,
 * turmeric as the single accent, brick reserved for losses.
 */
export const colors = {
  leaf: '#0E4D3A',
  leafMid: '#1F6B52',
  leafTint: '#E3EFE8',
  turmeric: '#E3A008',
  turmericDeep: '#8A5A00',
  turmericTint: '#FBF0CF',
  ink: '#13231B',
  inkSoft: '#4A5E54',
  inkFaint: '#66786E',
  paper: '#F3F7F4',
  card: '#FFFFFF',
  line: '#DAE5DE',
  brick: '#A9402C',
  brickTint: '#F7E4DF',
  onDark: '#FFFFFF',
  onDarkSoft: 'rgba(255,255,255,0.8)',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, huge: 32 } as const;

// Different radii for different jobs: the hero page is the softest shape.
export const radius = { hero: 24, card: 16, tile: 14, control: 14, pill: 999 } as const;

// Tamil glyphs are taller than Latin ones, so every size gets generous line height.
export const typo = StyleSheet.create({
  display: { fontSize: 44, lineHeight: 56, fontWeight: '800', fontVariant: ['tabular-nums'] },
  title: { fontSize: 24, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 17, lineHeight: 26, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 23, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 23, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 20, fontWeight: '400' },
  money: { fontVariant: ['tabular-nums'] },
  moneyLarge: { fontSize: 24, lineHeight: 32, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
