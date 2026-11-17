/**
 * Simple-UI tokens. Builds on the khata theme in ../theme but with bigger
 * type and touch targets for owners who are not used to apps.
 */
import { colors as base, radius as baseRadius, space as baseSpace } from '../theme';

export const ui = {
  ...base,
  primary: base.leaf,
  primaryMid: base.leafMid,
  primaryTint: base.leafTint,
  accent: base.turmeric,
  danger: base.brick,
  dangerTint: base.brickTint,
  good: '#1B7F4B',
  goodTint: '#E2F4EA',
  bg: base.paper,
  surface: base.card,
  border: base.line,
  text: base.ink,
  textSoft: base.inkSoft,
  textFaint: base.inkFaint,
} as const;

export const sp = baseSpace;
export const rad = baseRadius;

/** Minimum touch target (dp). */
export const TOUCH = 52;

/** Tamil glyphs are tall, so line heights are generous. */
export const font = {
  hero: { fontSize: 34, lineHeight: 44, fontWeight: '800' as const, fontVariant: ['tabular-nums' as const] },
  title: { fontSize: 24, lineHeight: 34, fontWeight: '800' as const },
  heading: { fontSize: 19, lineHeight: 28, fontWeight: '700' as const },
  body: { fontSize: 17, lineHeight: 26, fontWeight: '400' as const },
  bodyStrong: { fontSize: 17, lineHeight: 26, fontWeight: '700' as const },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  money: { fontSize: 22, lineHeight: 30, fontWeight: '800' as const, fontVariant: ['tabular-nums' as const] },
  moneyBig: { fontSize: 30, lineHeight: 40, fontWeight: '800' as const, fontVariant: ['tabular-nums' as const] },
};

export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;
