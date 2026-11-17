import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { numberToInput, parseDecimal, sanitizeDecimalInput } from '../lib/numberInput';
import { font, rad, sp, TOUCH, ui } from './tokens';

/** Big − [qty] + control. The middle box accepts decimals (0.5 kg). */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(numberToInput(value));

  // Keep the box in sync when +/- or a parent changes the value.
  useEffect(() => {
    if (parseDecimal(text) !== value) setText(numberToInput(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const bump = (dir: 1 | -1) => {
    const next = Math.max(min, Math.round((value + dir * step) * 1000) / 1000);
    setText(numberToInput(next));
    onChange(next);
  };

  return (
    <View style={s.row}>
      <Pressable
        onPress={() => bump(-1)}
        accessibilityRole="button"
        accessibilityLabel={t('ui.decrease')}
        style={({ pressed }) => [s.btn, s.minus, pressed && { opacity: 0.7 }]}
      >
        <Text style={[s.glyph, { color: ui.danger }]}>−</Text>
      </Pressable>
      <TextInput
        value={text}
        onChangeText={(v) => {
          const clean = sanitizeDecimalInput(v, 3);
          setText(clean);
          onChange(parseDecimal(clean));
        }}
        keyboardType="decimal-pad"
        selectTextOnFocus
        style={s.input}
        accessibilityLabel={t('ui.quantity')}
      />
      <Pressable
        onPress={() => bump(1)}
        accessibilityRole="button"
        accessibilityLabel={t('ui.increase')}
        style={({ pressed }) => [s.btn, s.plus, pressed && { opacity: 0.7 }]}
      >
        <Text style={[s.glyph, { color: ui.onDark }]}>+</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: sp.sm },
  btn: { width: TOUCH, height: TOUCH, borderRadius: rad.control, alignItems: 'center', justifyContent: 'center' },
  minus: { backgroundColor: ui.dangerTint },
  plus: { backgroundColor: ui.primary },
  glyph: { fontSize: 30, lineHeight: 34, fontWeight: '800' },
  input: {
    ...font.money,
    minWidth: 72,
    height: TOUCH,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: rad.control,
    backgroundColor: ui.surface,
    color: ui.text,
    paddingVertical: 0,
  },
});
