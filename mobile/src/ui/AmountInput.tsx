import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { sanitizeDecimalInput } from '../lib/numberInput';
import { font, rad, sp, ui } from './tokens';

/** A big ₹ box. Keeps text so "12." and "0.50" can be typed. */
export function AmountInput({
  label,
  value,
  onChangeText,
  placeholder = '0',
  autoFocus,
  style,
  prefix = '₹',
  decimals = 2,
}: {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  prefix?: string;
  decimals?: number;
}) {
  return (
    <View style={style}>
      {label ? <Text style={[font.bodyStrong, { color: ui.textSoft, marginBottom: sp.xs }]}>{label}</Text> : null}
      <View style={s.box}>
        {prefix ? <Text style={[font.moneyBig, { color: ui.textSoft }]}>{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={(v) => onChangeText(sanitizeDecimalInput(v, decimals))}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={ui.textFaint}
          autoFocus={autoFocus}
          style={s.input}
          accessibilityLabel={label}
        />
      </View>
    </View>
  );
}

/** Plain big text box with a label (names, phone numbers). */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoFocus,
  maxLength,
  autoCapitalize,
}: {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'email-address' | 'number-pad';
  autoFocus?: boolean;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View>
      {label ? <Text style={[font.bodyStrong, { color: ui.textSoft, marginBottom: sp.xs }]}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={ui.textFaint}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        style={s.text}
        accessibilityLabel={label}
      />
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    borderWidth: 2,
    borderColor: ui.primary,
    borderRadius: rad.control,
    backgroundColor: ui.surface,
    paddingHorizontal: sp.lg,
    minHeight: 64,
  },
  input: { ...font.moneyBig, flex: 1, color: ui.text, paddingVertical: sp.sm },
  text: {
    ...font.body,
    fontSize: 18,
    minHeight: 56,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: rad.control,
    backgroundColor: ui.surface,
    color: ui.text,
    paddingHorizontal: sp.lg,
  },
});
