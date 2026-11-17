import React from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { font, sp, TOUCH, ui } from './tokens';

export function Header({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <View style={s.row}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={8}
          style={({ pressed }) => [s.back, pressed && { opacity: 0.7 }]}
        >
          <Text style={s.backGlyph}>‹</Text>
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[font.title, { color: ui.text }]} accessibilityRole="header" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={[font.small, { color: ui.textSoft }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: sp.md, marginBottom: sp.sm },
  back: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: TOUCH / 2,
    backgroundColor: ui.surface,
    borderWidth: 1,
    borderColor: ui.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: { fontSize: 34, lineHeight: 38, color: ui.primary, fontWeight: '700', marginTop: -4 },
});
