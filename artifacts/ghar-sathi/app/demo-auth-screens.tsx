import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import {
  ActionButton,
  BrandHeader,
  ContentScroll,
  InlineMessage,
  InputField,
  LanguageSwitcher,
  Screen,
  Surface,
} from '@/components/GharSathiUI';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/lib/locale';
import { useDemoAuth } from '@/lib/demo-auth';

function DemoNotice() {
  const colors = useColors();
  return (
    <View
      style={{
        padding: 12,
        borderRadius: 14,
        backgroundColor: colors.accent,
      }}
    >
      <Text style={{ color: colors.accentForeground, fontSize: 12, lineHeight: 18 }}>
        DEMO MODE · This is a local-only prototype account. No Clerk or Supabase sign-in is used.
      </Text>
    </View>
  );
}

export function DemoSignInScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t } = useLanguage();
  const { signIn } = useDemoAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      await signIn(email);
      router.replace('/');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open the demo account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ContentScroll style={{ paddingTop: 16, paddingBottom: 36 }}>
        <LanguageSwitcher />
        <BrandHeader eyebrow={t('tagline')} />
        <View style={{ height: 24 }} />
        <DemoNotice />
        <View style={{ height: 20 }} />
        <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: '700' }}>
          Demo sign in
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 21 }}>
          Use an email you previously registered on this device. The password is only checked for length and is not sent or stored.
        </Text>
        <Surface style={{ marginTop: 10 }}>
          <InputField
            label={t('email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            testID="demo-sign-in-email"
          />
          <InputField
            label="Demo password (8+ characters)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            testID="demo-sign-in-password"
          />
          <InlineMessage text={error} />
          <ActionButton
            label="Continue to demo"
            onPress={() => void submit()}
            loading={loading}
            disabled={!email.includes('@') || password.length < 8}
            testID="demo-sign-in-submit"
          />
        </Surface>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>New to MAID.com?</Text>
          <Link href="/(auth)/sign-up" style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>
            Create demo account
          </Link>
        </View>
      </ContentScroll>
    </Screen>
  );
}

export function DemoSignUpScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t } = useLanguage();
  const { signUp } = useDemoAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      await signUp(fullName, email);
      router.replace('/onboarding');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the local demo account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ContentScroll style={{ paddingTop: 16, paddingBottom: 36 }}>
        <LanguageSwitcher />
        <BrandHeader eyebrow={t('tagline')} />
        <View style={{ height: 24 }} />
        <DemoNotice />
        <View style={{ height: 20 }} />
        <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: '700' }}>
          Create a demo account
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 21 }}>
          This creates a device-local profile so you can preview the marketplace without connecting an auth provider.
        </Text>
        <Surface style={{ marginTop: 10 }}>
          <InputField
            label={t('fullName')}
            value={fullName}
            onChangeText={setFullName}
            autoComplete="name"
            testID="demo-sign-up-name"
          />
          <InputField
            label={t('email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            testID="demo-sign-up-email"
          />
          <InputField
            label="Demo password (8+ characters)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            hint="Not sent to a server and not stored."
            testID="demo-sign-up-password"
          />
          <InlineMessage text={error} />
          <ActionButton
            label="Create demo account"
            onPress={() => void submit()}
            loading={loading}
            disabled={fullName.trim().length < 2 || !email.includes('@') || password.length < 8}
            testID="demo-sign-up-submit"
          />
        </Surface>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Already registered on this device?</Text>
          <Link href="/(auth)/sign-in" style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>
            Sign in
          </Link>
        </View>
      </ContentScroll>
    </Screen>
  );
}
