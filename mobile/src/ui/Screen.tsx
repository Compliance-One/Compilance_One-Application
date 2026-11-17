import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { sp, ui } from './tokens';

/** Set by the tab navigator: the tab bar already handles the bottom inset. */
export const InTabContext = createContext(false);

export interface ScreenProps {
  children: ReactNode;
  /** Wrap children in a ScrollView (default true). Set false when the child is a list. */
  scroll?: boolean;
  /** Safe-area edges. Tab screens: ['top']; stack screens with a native header: ['bottom']. */
  edges?: Edge[];
  /** Pinned below the content; rises above the keyboard (use for Save buttons). */
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Extra offset for KeyboardAvoidingView when a native header sits above. */
  keyboardOffset?: number;
}

/**
 * Every screen sits inside this: safe area (no drawing under the status bar or
 * gesture bar), keyboard avoidance, and a scroll view that keeps taps working
 * while the keyboard is open.
 */
export function Screen({
  children,
  scroll = true,
  edges = ['top', 'bottom'],
  footer,
  style,
  contentStyle,
  keyboardOffset = 0,
}: ScreenProps) {
  const inTab = useContext(InTabContext);
  const finalEdges = inTab ? edges.filter((e) => e !== 'bottom') : edges;
  return (
    <SafeAreaView edges={finalEdges} style={[s.root, style]}>
      <KeyboardAvoidingView
        style={s.flex}
        // Android is edge-to-edge (the window is not resized), so pad on both platforms.
        behavior="padding"
        keyboardVerticalOffset={keyboardOffset}
      >
        {scroll ? (
          <ScrollView
            style={s.flex}
            contentContainerStyle={[s.content, contentStyle]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[s.flex, contentStyle]}>{children}</View>
        )}
        {footer ? <View style={s.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.bg },
  flex: { flex: 1 },
  content: { padding: sp.lg, paddingBottom: sp.huge, gap: sp.md },
  footer: {
    paddingHorizontal: sp.lg,
    paddingVertical: sp.md,
    backgroundColor: ui.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.border,
    gap: sp.sm,
  },
});
