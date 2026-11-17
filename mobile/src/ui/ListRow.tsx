import React from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { initialOf } from '../lib/format';
import { font, rad, sp, ui } from './tokens';

export function ListRow({
  title,
  subtitle,
  right,
  rightSub,
  rightTone = 'ink',
  icon,
  avatar,
  onPress,
  trailing,
}: {
  title: string;
  subtitle?: string;
  right?: string;
  rightSub?: string;
  rightTone?: 'ink' | 'bad' | 'good' | 'faint';
  icon?: string;
  avatar?: string;
  onPress?: () => void;
  trailing?: ReactNode;
}) {
  const toneColor = { ink: ui.text, bad: ui.danger, good: ui.good, faint: ui.textFaint }[rightTone];
  const body = (
    <>
      {icon ? (
        <View style={s.lead}>
          <Text style={{ fontSize: 24 }}>{icon}</Text>
        </View>
      ) : avatar !== undefined ? (
        <View style={[s.lead, { backgroundColor: ui.primaryTint }]}>
          <Text style={[font.heading, { color: ui.primary }]}>{initialOf(avatar)}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[font.bodyStrong, { color: ui.text }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[font.small, { color: ui.textSoft }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[font.money, { fontSize: 19, color: toneColor }]}>{right}</Text>
          {rightSub ? <Text style={[font.small, { color: ui.textFaint }]}>{rightSub}</Text> : null}
        </View>
      ) : null}
      {trailing}
      {onPress && !trailing ? <Text style={s.chev}>›</Text> : null}
    </>
  );
  if (!onPress) return <View style={s.row}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, right].filter(Boolean).join(', ')}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: ui.primaryTint }]}
    >
      {body}
    </Pressable>
  );
}

/** White rounded panel. */
export function Panel({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[s.panel, style]}>{children}</View>;
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
    minHeight: 68,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.md,
    backgroundColor: ui.surface,
    borderRadius: rad.card,
    borderWidth: 1,
    borderColor: ui.border,
  },
  lead: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ui.bg,
  },
  chev: { fontSize: 28, color: ui.textFaint, marginLeft: sp.xs },
  panel: {
    backgroundColor: ui.surface,
    borderRadius: rad.card,
    borderWidth: 1,
    borderColor: ui.border,
    padding: sp.lg,
    gap: sp.sm,
  },
});
