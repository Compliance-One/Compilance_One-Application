import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { font, rad, sp, TOUCH, ui } from './tokens';

type Variant = 'primary' | 'secondary' | 'danger' | 'good' | 'ghost';

export function BigButton({
  label,
  sublabel,
  icon,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  style,
  compact,
}: {
  label: string;
  sublabel?: string;
  icon?: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const inactive = !!disabled || !!busy;
  const v = variants[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={sublabel ? `${label}, ${sublabel}` : label}
      accessibilityState={{ disabled: inactive, busy: !!busy }}
      style={({ pressed }) => [
        s.btn,
        compact && s.compact,
        { backgroundColor: v.bg, borderColor: v.border },
        inactive && s.disabled,
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={s.inner}>
          {icon ? <Text style={s.icon}>{icon}</Text> : null}
          <View style={{ alignItems: 'center', flexShrink: 1 }}>
            <Text style={[font.bodyStrong, { color: v.fg, fontSize: compact ? 16 : 18, textAlign: 'center' }]} numberOfLines={2}>
              {label}
            </Text>
            {sublabel ? (
              <Text style={[font.small, { color: v.fg, opacity: 0.8, fontSize: 12, lineHeight: 16 }]} numberOfLines={1}>
                {sublabel}
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

const variants: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: ui.primary, fg: ui.onDark, border: ui.primary },
  good: { bg: ui.good, fg: ui.onDark, border: ui.good },
  secondary: { bg: ui.surface, fg: ui.primary, border: ui.primary },
  danger: { bg: ui.dangerTint, fg: ui.danger, border: ui.danger },
  ghost: { bg: 'transparent', fg: ui.primary, border: 'transparent' },
};

const s = StyleSheet.create({
  btn: {
    minHeight: 60,
    borderRadius: rad.control,
    borderWidth: 2,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { minHeight: TOUCH },
  disabled: { opacity: 0.45 },
  inner: { flexDirection: 'row', alignItems: 'center', gap: sp.sm },
  icon: { fontSize: 22 },
});
