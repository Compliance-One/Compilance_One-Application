import React, { useEffect, useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { numberToInput, parseDecimal, sanitizeDecimalInput } from '../lib/numberInput';

/**
 * Drop-in TextInput for a number field. Keeps the typed text locally so "2."
 * or "0.5" survive, and reports the parsed number to the parent.
 */
export function DecimalInput({
  value,
  onValue,
  decimals = 2,
  ...rest
}: Omit<TextInputProps, 'value' | 'onChangeText'> & {
  value: number;
  onValue: (n: number) => void;
  decimals?: number;
}) {
  const [text, setText] = useState(value ? numberToInput(value) : '');
  useEffect(() => {
    if (parseDecimal(text) !== value) setText(value ? numberToInput(value) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <TextInput
      {...rest}
      value={text}
      keyboardType={decimals > 0 ? 'decimal-pad' : 'number-pad'}
      placeholder={rest.placeholder ?? '0'}
      onChangeText={(v) => {
        const clean = sanitizeDecimalInput(v, decimals);
        setText(clean);
        onValue(parseDecimal(clean));
      }}
    />
  );
}
