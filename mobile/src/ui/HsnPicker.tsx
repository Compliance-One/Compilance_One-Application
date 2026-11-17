import React, { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { searchHsn, type HsnEntry } from '../lib/hsn';
import { font, rad, sp, TOUCH, ui } from './tokens';

/** "🔍 Find HSN" button + searchable list. Picking fills the HSN and (if known) the GST rate. */
export function HsnPicker({ onPick, initialQuery = '' }: { onPick: (e: HsnEntry) => void; initialQuery?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const results = useMemo(() => searchHsn(q, 40), [q]);

  return (
    <>
      <Pressable
        onPress={() => {
          setQ(initialQuery);
          setOpen(true);
        }}
        style={({ pressed }) => [s.btn, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
      >
        <Text style={[font.bodyStrong, { color: ui.primary, fontSize: 15 }]}>🔍 {t('hsn.find')}</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView behavior="padding" style={s.overlay}>
          <View style={s.sheet}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm }}>
              <Text style={[font.heading, { flex: 1, color: ui.text }]}>{t('hsn.title')}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10} style={s.close}>
                <Text style={{ fontSize: 22 }}>✕</Text>
              </Pressable>
            </View>
            <TextInput
              value={q}
              onChangeText={setQ}
              autoFocus
              placeholder={t('hsn.placeholder')}
              placeholderTextColor={ui.textFaint}
              style={s.search}
            />
            <FlatList
              data={results}
              keyExtractor={(e) => e.code}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={[font.body, { color: ui.textSoft, padding: sp.md }]}>{t('hsn.none')}</Text>}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onPick(item);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [s.row, pressed && { backgroundColor: ui.primaryTint }]}
                >
                  <View style={s.code}>
                    <Text style={[font.bodyStrong, { color: ui.primary }]}>{item.code}</Text>
                  </View>
                  <Text style={[font.body, { flex: 1, color: ui.text, fontSize: 15 }]} numberOfLines={2}>
                    {item.description}
                  </Text>
                  <Text style={[font.bodyStrong, { color: ui.textSoft }]}>{item.rate === null ? '—' : `${item.rate}%`}</Text>
                </Pressable>
              )}
            />
            <Text style={[font.small, { color: ui.textFaint }]}>{t('hsn.note')}</Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  btn: {
    minHeight: 44,
    borderRadius: rad.control,
    borderWidth: 1,
    borderColor: ui.primary,
    backgroundColor: ui.primaryTint,
    paddingHorizontal: sp.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: sp.xs,
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    height: '85%',
    backgroundColor: ui.surface,
    borderTopLeftRadius: rad.hero,
    borderTopRightRadius: rad.hero,
    padding: sp.lg,
    gap: sp.sm,
  },
  close: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  search: {
    ...font.body,
    minHeight: TOUCH,
    borderWidth: 2,
    borderColor: ui.primary,
    borderRadius: rad.control,
    paddingHorizontal: sp.md,
    color: ui.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
    paddingVertical: sp.md,
    paddingHorizontal: sp.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.border,
    minHeight: 56,
  },
  code: { minWidth: 64, paddingHorizontal: sp.sm, paddingVertical: 4, borderRadius: 8, backgroundColor: ui.primaryTint, alignItems: 'center' },
});
