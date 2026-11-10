import React from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, space, typo } from '../../theme';
import { initialOf } from '../../lib/format';
import type { ActiveBusiness, AsyncState } from '../../hooks/useReport';

type Tone = 'ink' | 'good' | 'bad' | 'warn' | 'faint';

const toneColor: Record<Tone, string> = {
  ink: colors.ink,
  good: colors.leafMid,
  bad: colors.brick,
  warn: colors.turmericDeep,
  faint: colors.inkFaint,
};

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

export function ScreenHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={s.header}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={s.backChip}
        >
          <Text style={s.backText}>{'‹  ' + t('common.back')}</Text>
        </Pressable>
      ) : null}
      <Text style={typo.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={[typo.body, { color: colors.inkSoft }]}>{subtitle}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* The one memorable element: a khata (ledger book) page               */
/* ------------------------------------------------------------------ */

export function LedgerPaper({ lines = 12, gap = 30 }: { lines?: number; gap?: number }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      {Array.from({ length: lines }, (_, i) => (
        <View key={i} style={[s.paperLine, { top: 22 + i * gap }]} />
      ))}
      <View style={s.paperMargin} />
    </View>
  );
}

/** Dark ruled page. Content is inset so it sits to the right of the margin line. */
export function LedgerHero({ children, bad }: { children: ReactNode; bad?: boolean }) {
  return (
    <View style={[s.hero, { backgroundColor: bad ? colors.brick : colors.leaf }]}>
      <LedgerPaper />
      <View style={s.heroBody}>{children}</View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Cards, tiles, rows                                                  */
/* ------------------------------------------------------------------ */

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <Text style={[typo.heading, s.sectionTitle]} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function StatTile({
  label,
  value,
  tone = 'ink',
}: {
  label: string;
  value: string;
  tone?: Tone;
}) {
  return (
    <View style={s.tile} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[typo.caption, { color: colors.inkSoft }]}>{label}</Text>
      <Text style={[typo.moneyLarge, { color: toneColor[tone] }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

export function Meter({
  ratio,
  color = colors.leaf,
  track = colors.leafTint,
  height = 8,
}: {
  ratio: number;
  color?: string;
  track?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <View
        style={{
          width: `${pct * 100}%` as `${number}%`,
          height,
          borderRadius: height / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** A label/value line with an optional proportional bar underneath. */
export function AmountRow({
  label,
  value,
  tone = 'ink',
  ratio,
  barColor,
  caption,
  strong,
}: {
  label: string;
  value: string;
  tone?: Tone;
  ratio?: number;
  barColor?: string;
  caption?: string;
  strong?: boolean;
}) {
  return (
    <View style={s.amountRow} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={s.amountLine}>
        <Text style={[strong ? typo.bodyStrong : typo.body, s.amountLabel]}>{label}</Text>
        <Text style={[typo.money, strong ? typo.heading : typo.bodyStrong, { color: toneColor[tone] }]}>
          {value}
        </Text>
      </View>
      {ratio !== undefined ? (
        <View style={{ marginTop: space.xs }}>
          <Meter ratio={ratio} color={barColor} height={6} />
        </View>
      ) : null}
      {caption ? <Text style={[typo.caption, { color: colors.inkFaint }]}>{caption}</Text> : null}
    </View>
  );
}

export function NavRow({
  title,
  hint,
  onPress,
}: {
  title: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
      style={({ pressed }) => [s.navRow, pressed && { backgroundColor: colors.leafTint }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={typo.bodyStrong}>{title}</Text>
        <Text style={[typo.caption, { color: colors.inkSoft }]}>{hint}</Text>
      </View>
      <Text style={s.chevron}>›</Text>
    </Pressable>
  );
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const palette = [colors.leafTint, colors.turmericTint, '#E6ECF7', '#F3E6F1'];
  const textPalette = [colors.leaf, colors.turmericDeep, '#2C4A7C', '#6B2F62'];
  const idx = Array.from(name).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % palette.length;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: palette[idx],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.4, fontWeight: '700', color: textPalette[idx] }}>{initialOf(name)}</Text>
    </View>
  );
}

export function Pill({ label, tone }: { label: string; tone: 'warn' | 'good' | 'faint' }) {
  const bg = tone === 'warn' ? colors.turmericTint : tone === 'good' ? colors.leafTint : colors.paper;
  const fg = tone === 'warn' ? colors.turmericDeep : tone === 'good' ? colors.leaf : colors.inkFaint;
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={[typo.caption, { color: fg, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}

export function Banner({ tone, text }: { tone: 'warn' | 'info'; text: string }) {
  const bg = tone === 'warn' ? colors.turmericTint : colors.leafTint;
  const fg = tone === 'warn' ? colors.turmericDeep : colors.leaf;
  return (
    <View style={[s.banner, { backgroundColor: bg }]} accessibilityRole="alert">
      <Text style={[typo.body, { color: fg }]}>{text}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.segRow}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[s.seg, active ? s.segActive : s.segIdle]}
          >
            <Text
              style={[typo.bodyStrong, { color: active ? colors.onDark : colors.inkSoft }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function MonthStepper({
  label,
  onPrev,
  onNext,
  canNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  canNext: boolean;
}) {
  return (
    <View style={s.stepper}>
      <Pressable onPress={onPrev} hitSlop={10} accessibilityRole="button" accessibilityLabel="Previous month" style={s.stepBtn}>
        <Text style={s.stepGlyph}>‹</Text>
      </Pressable>
      <Text style={typo.heading} accessibilityLiveRegion="polite">
        {label}
      </Text>
      <Pressable
        onPress={onNext}
        disabled={!canNext}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Next month"
        accessibilityState={{ disabled: !canNext }}
        style={[s.stepBtn, !canNext && { opacity: 0.35 }]}
      >
        <Text style={s.stepGlyph}>›</Text>
      </Pressable>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const inactive = !!disabled || !!busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: !!busy }}
      style={({ pressed }) => [s.btn, s.btnPrimary, inactive && s.btnDisabled, pressed && { opacity: 0.85 }]}
    >
      {busy ? <ActivityIndicator color={colors.onDark} /> : <Text style={s.btnPrimaryText}>{label}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.btn, s.btnSecondary, pressed && { opacity: 0.85 }]}
    >
      <Text style={s.btnSecondaryText}>{label}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Loading / error / empty                                             */
/* ------------------------------------------------------------------ */

export function EmptyBlock({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={s.centerBlock}>
      <Text style={[typo.heading, { textAlign: 'center' }]}>{title}</Text>
      {hint ? <Text style={[typo.body, s.centerHint]}>{hint}</Text> : null}
    </View>
  );
}

/** Renders loading / error / no-business states, or the screen body once data is ready. */
export function ReportState<T>({
  state,
  onRetry,
  children,
}: {
  state: AsyncState<T>;
  onRetry: () => void;
  children: (data: T, business: ActiveBusiness) => ReactNode;
}) {
  const { t } = useTranslation();

  if (state.status === 'loading') {
    return (
      <View style={s.centerBlock} accessibilityLiveRegion="polite">
        <ActivityIndicator size="large" color={colors.leaf} />
        <Text style={[typo.body, s.centerHint]}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={s.centerBlock} accessibilityRole="alert">
        <Text style={[typo.heading, { textAlign: 'center' }]}>{t('common.errorTitle')}</Text>
        <Text style={[typo.caption, s.centerHint]}>{state.message}</Text>
        <View style={{ marginTop: space.lg, alignSelf: 'stretch' }}>
          <SecondaryButton label={t('common.retry')} onPress={onRetry} />
        </View>
      </View>
    );
  }

  if (state.status === 'empty') {
    return <EmptyBlock title={t('common.noBusinessTitle')} hint={t('common.noBusinessHint')} />;
  }

  return <>{children(state.data, state.business)}</>;
}

/* ------------------------------------------------------------------ */

const s = StyleSheet.create({
  header: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.md, gap: space.xs },
  backChip: { alignSelf: 'flex-start', paddingVertical: space.xs },
  backText: { ...typo.bodyStrong, color: colors.leaf },

  paperLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  paperMargin: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 52,
    width: 1.5,
    backgroundColor: 'rgba(227,160,8,0.7)',
  },
  hero: { borderRadius: radius.hero, overflow: 'hidden' },
  heroBody: { paddingLeft: 68, paddingRight: space.xl, paddingTop: space.xl, paddingBottom: space.xl },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
  },
  sectionTitle: { marginTop: space.xl, marginBottom: space.sm, paddingHorizontal: space.xs },
  tile: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.card,
    borderRadius: radius.tile,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    gap: space.xs,
  },
  amountRow: { paddingVertical: space.sm },
  amountLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  amountLabel: { flex: 1, color: colors.ink },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    gap: space.md,
    minHeight: 60,
  },
  chevron: { fontSize: 26, lineHeight: 28, color: colors.inkFaint },
  pill: { alignSelf: 'flex-start', paddingHorizontal: space.md, paddingVertical: 2, borderRadius: radius.pill },
  banner: { borderRadius: radius.tile, padding: space.lg },

  segRow: { flexDirection: 'row', gap: space.sm },
  seg: {
    flex: 1,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segActive: { backgroundColor: colors.leaf, borderColor: colors.leaf },
  segIdle: { backgroundColor: colors.card, borderColor: colors.line },

  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepGlyph: { fontSize: 28, lineHeight: 32, color: colors.leaf },

  btn: {
    minHeight: 52,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  btnPrimary: { backgroundColor: colors.leaf },
  btnDisabled: { backgroundColor: colors.inkFaint, opacity: 0.55 },
  btnPrimaryText: { ...typo.heading, color: colors.onDark },
  btnSecondary: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.leaf },
  btnSecondaryText: { ...typo.heading, color: colors.leaf },

  centerBlock: { alignItems: 'center', justifyContent: 'center', padding: space.huge, gap: space.sm },
  centerHint: { textAlign: 'center', color: colors.inkSoft },
});
