import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, space, typo } from '../../theme';
import { Card, PrimaryButton } from '../../components/reports/ui';
import { login, parseAuthError } from '../../auth/session';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!identifier.trim() || !password) {
      setError(t('auth.missingFields'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(identifier.trim(), password);
    } catch (e) {
      setError(t(parseAuthError(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={typo.title}>{t('auth.loginTitle')}</Text>
      <Text style={[typo.caption, { color: colors.inkSoft, marginBottom: space.lg }]}>
        {t('auth.loginHint')}
      </Text>
      <Card style={{ gap: space.sm }}>
        <Text style={[typo.caption, { color: colors.inkSoft }]}>{t('auth.identifier')}</Text>
        <TextInput
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          placeholder={t('auth.identifierPlaceholder')}
          placeholderTextColor={colors.inkSoft}
        />
        <Text style={[typo.caption, { color: colors.inkSoft }]}>{t('auth.password')}</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          placeholder={t('auth.passwordPlaceholder')}
          placeholderTextColor={colors.inkSoft}
        />
        {error ? <Text style={[typo.caption, { color: colors.brick }]}>{error}</Text> : null}
        <PrimaryButton label={busy ? t('auth.signingIn') : t('auth.signIn')} onPress={() => void submit()} />
        {busy ? <ActivityIndicator color={colors.leaf} /> : null}
      </Card>
      <Pressable onPress={() => navigation.navigate('Register')} style={{ marginTop: space.lg }}>
        <Text style={[typo.bodyStrong, { color: colors.leaf, textAlign: 'center' }]}>
          {t('auth.needAccount')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, padding: space.xl, justifyContent: 'center' },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.card,
  },
});
