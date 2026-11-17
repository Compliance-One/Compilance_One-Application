import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, space, typo } from '../../theme';
import { Card, PrimaryButton } from '../../components/reports/ui';
import { parseAuthError, register } from '../../auth/session';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || !phone.trim() || password.length < 8) {
      setError(t('auth.registerValidation'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register({
        name: name.trim(),
        phone: phone.trim(),
        password,
        email: email.trim() || undefined,
      });
    } catch (e) {
      setError(t(parseAuthError(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={typo.title}>{t('auth.registerTitle')}</Text>
      <Text style={[typo.caption, { color: colors.inkSoft, marginBottom: space.lg }]}>
        {t('auth.registerHint')}
      </Text>
      <Card style={{ gap: space.sm }}>
        <Text style={[typo.caption, { color: colors.inkSoft }]}>{t('auth.name')}</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} placeholder={t('auth.namePlaceholder')} placeholderTextColor={colors.inkSoft} />
        <Text style={[typo.caption, { color: colors.inkSoft }]}>{t('auth.phone')}</Text>
        <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} placeholder={t('auth.phonePlaceholder')} placeholderTextColor={colors.inkSoft} />
        <Text style={[typo.caption, { color: colors.inkSoft }]}>{t('auth.emailOptional')}</Text>
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} placeholder={t('auth.emailPlaceholder')} placeholderTextColor={colors.inkSoft} />
        <Text style={[typo.caption, { color: colors.inkSoft }]}>{t('auth.password')}</Text>
        <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} placeholder={t('auth.passwordMin')} placeholderTextColor={colors.inkSoft} />
        {error ? <Text style={[typo.caption, { color: colors.brick }]}>{error}</Text> : null}
        <PrimaryButton label={busy ? t('auth.creating') : t('auth.createAccount')} onPress={() => void submit()} />
        {busy ? <ActivityIndicator color={colors.leaf} /> : null}
      </Card>
      <Pressable onPress={() => navigation.navigate('Login')} style={{ marginTop: space.lg }}>
        <Text style={[typo.bodyStrong, { color: colors.leaf, textAlign: 'center' }]}>
          {t('auth.haveAccount')}
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
