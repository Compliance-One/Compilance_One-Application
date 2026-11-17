import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { font, rad, shadow, sp, ui } from './tokens';

export function Tile({
  icon,
  label,
  sublabel,
  onPress,
  color = ui.primary,
  tint = ui.primaryTint,
}: {
  icon: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
  color?: string;
  tint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={sublabel ? `${label}, ${sublabel}` : label}
      style={({ pressed }) => [s.tile, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
    >
      <View style={[s.iconWrap, { backgroundColor: tint }]}>
        <Text style={s.icon}>{icon}</Text>
      </View>
      <Text style={[font.heading, { color, textAlign: 'center' }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
        {label}
      </Text>
      {sublabel ? (
        <Text style={[font.small, { color: ui.textFaint, textAlign: 'center' }]} numberOfLines={1}>
          {sublabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 140,
    backgroundColor: ui.surface,
    borderRadius: rad.card,
    borderWidth: 1,
    borderColor: ui.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: sp.md,
    gap: sp.xs,
    ...shadow,
  },
  iconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: sp.xs },
  icon: { fontSize: 30 },
});
