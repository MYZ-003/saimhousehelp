import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useSignUp, useSSO } from '@clerk/expo';
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

WebBrowser.maybeCompleteAuthSession();

function readableError(error: unknown) {
  const authError = error as { errors?: Array<{ longMessage?: string; message?: string }> };
  return authError?.errors?.[0]?.longMessage ?? authError?.errors?.[0]?.message ??
    (error instanceof Error ? error.message : 'Please try again.');
}

function GoogleButton({ onError }: { onError: (message: string) => void }) {
  const router = useRouter();
  const { startSSOFlow } = useSSO();
  const [loading, setLoading] = useState(false);

  const begin = async () => {
    setLoading(true);
    try {
      const result = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri({
          scheme: 'ghar-sathi',
          path: 'oauth-native-callback',
        }),
      });
      if (result.createdSessionId && result.setActive) {
        await result.setActive({
          session: result.createdSessionId,
          navigate: () => router.replace('/'),
        });
      } else {
        onError('Google sign-in needs another verification step. Try email and password for now.');
      }
    } catch (error) {
      onError(readableError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ActionButton
      label="Continue with Google"
      icon="globe"
      variant="outline"
      onPress={begin}
      loading={loading}
      testID="google-sign-up"
    />
  );
}

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, fetchStatus } = useSignUp();
  const colors = useColors();
  const { t } = useLanguage();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const finalize = async () => {
    if (!signUp) return;
    await signUp.finalize({ navigate: () => router.replace('/onboarding') });
  };

  const submit = async () => {
    if (!signUp || fetchStatus === 'fetching') return;
    setLoading(true);
    setError('');
    try {
      if (awaitingCode) {
        const result = await signUp.verifications.verifyEmailCode({ code: verificationCode.trim() });
        if (result.error) {
          setError(readableError(result.error));
        } else if (signUp.status === 'complete') {
          await finalize();
        } else {
          setError('That code could not complete sign-up. Check it and try again.');
        }
      } else {
        const result = await signUp.password({ emailAddress: emailAddress.trim(), password });
        if (result.error) {
          setError(readableError(result.error));
        } else if (signUp.status === 'complete') {
          await finalize();
        } else if (signUp.status === 'missing_requirements') {
          await signUp.verifications.sendEmailCode();
          setAwaitingCode(true);
        } else {
          setError('The account could not be created. Please check your details and try again.');
        }
      }
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (!signUp || fetchStatus === 'fetching') return;
    setLoading(true);
    setError('');
    try {
      await signUp.verifications.sendEmailCode();
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ContentScroll style={{ paddingTop: 16, paddingBottom: 36 }}>
        <LanguageSwitcher />
        <BrandHeader eyebrow={t('tagline')} />
        <View style={{ height: 28 }} />
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.foreground, fontSize: 30, lineHeight: 36, fontWeight: '700' }}>
            {t('signUp')}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 15, lineHeight: 22 }}>
            Create one account, then choose whether you need help or provide it.
          </Text>
        </View>
        <Surface style={{ marginTop: 8 }}>
          <InputField
            label={t('email')}
            value={emailAddress}
            onChangeText={setEmailAddress}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!awaitingCode}
            testID="sign-up-email"
          />
          {!awaitingCode ? (
            <InputField
              label={t('password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              hint="Use at least 8 characters."
              testID="sign-up-password"
            />
          ) : (
            <>
              <View nativeID="clerk-captcha" style={{ minHeight: 1 }} />
              <InputField
                label="Email verification code"
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="number-pad"
                maxLength={8}
                testID="sign-up-code"
              />
            </>
          )}
          <InlineMessage text={error} />
          <ActionButton
            label={awaitingCode ? 'Verify email and continue' : 'Create account'}
            onPress={submit}
            loading={loading || fetchStatus === 'fetching'}
            disabled={fetchStatus === 'fetching' || !emailAddress || (!awaitingCode && password.length < 8)}
            testID="sign-up-submit"
          />
          {awaitingCode ? (
            <ActionButton label="Resend code" variant="quiet" onPress={resendCode} loading={loading || fetchStatus === 'fetching'} compact />
          ) : null}
          {!awaitingCode ? <GoogleButton onError={setError} /> : null}
        </Surface>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Already have an account?</Text>
          <Link href="/(auth)/sign-in" style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>
            {t('signIn')}
          </Link>
        </View>
      </ContentScroll>
    </Screen>
  );
}