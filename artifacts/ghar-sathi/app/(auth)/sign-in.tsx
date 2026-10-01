import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Link, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useAuth, useSignIn, useSSO } from '@clerk/expo';
import {
  ActionButton,
  BrandHeader,
  ContentScroll,
  InlineMessage,
  InputField,
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
  const colors = useColors();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android') {
      void WebBrowser.warmUpAsync().catch(() => undefined);
      return () => {
        void WebBrowser.coolDownAsync().catch(() => undefined);
      };
    }
  }, []);

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
      accessibilityLabel="Continue with Google"
      testID="google-sign-in"
    />
  );
}

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, fetchStatus } = useSignIn();
  const { isSignedIn } = useAuth();
  const colors = useColors();
  const { t } = useLanguage();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isSignedIn) router.replace('/');
  }, [isSignedIn, router]);

  const finish = async () => {
    if (!signIn) return;
    await signIn.finalize({ navigate: () => router.replace('/') });
  };

  const submit = async () => {
    if (!signIn || fetchStatus === 'fetching') return;
    setLoading(true);
    setError('');
    try {
      if (needsVerification) {
        const result = await signIn.mfa.verifyEmailCode({ code: verificationCode.trim() });
        if (result.error) {
          setError(readableError(result.error));
        } else if (signIn.status === 'complete') {
          await finish();
        } else {
          setError('That code could not finish sign-in. Check it and try again.');
        }
        return;
      }
      const result = await signIn.password({ emailAddress: emailAddress.trim(), password });
      if (result.error) {
        setError(readableError(result.error));
      } else if (signIn.status === 'complete') {
        await finish();
      } else if (signIn.status === 'needs_second_factor' || signIn.status === 'needs_client_trust') {
        const emailFactor = signIn.supportedSecondFactors?.find((factor) => factor.strategy === 'email_code');
        if (emailFactor) {
          await signIn.mfa.sendEmailCode();
          setNeedsVerification(true);
        } else {
          setError('Your account requires another verification method that is not available here.');
        }
      } else {
        setError('Additional verification is required to finish signing in.');
      }
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  };

  const requestCode = async () => {
    if (!signIn) return;
    setLoading(true);
    setError('');
    try {
      await signIn.mfa.sendEmailCode();
      setNeedsVerification(true);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ContentScroll style={{ paddingTop: 16, paddingBottom: 36 }}>
        <BrandHeader eyebrow={t('tagline')} />
        <View style={{ height: 28 }} />
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.foreground, fontSize: 30, lineHeight: 36, fontWeight: '700' }}>
            {t('signIn')}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 15, lineHeight: 22 }}>
            Sign in to find trusted household help or manage your service requests.
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
            testID="sign-in-email"
          />
          {!needsVerification ? (
            <InputField
              label={t('password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              testID="sign-in-password"
            />
          ) : (
            <InputField
              label="Email verification code"
              value={verificationCode}
              onChangeText={setVerificationCode}
              keyboardType="number-pad"
              maxLength={8}
              testID="sign-in-code"
            />
          )}
          <InlineMessage text={error} />
          <ActionButton
            label={needsVerification ? 'Verify and sign in' : t('signIn')}
            onPress={submit}
            loading={loading || fetchStatus === 'fetching'}
            disabled={fetchStatus === 'fetching' || !emailAddress || (!needsVerification && !password)}
            testID="sign-in-submit"
          />
          {needsVerification ? (
            <ActionButton label="Send a new code" variant="quiet" onPress={requestCode} loading={loading || fetchStatus === 'fetching'} compact />
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ height: 1, flex: 1, backgroundColor: colors.border }} />
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>OR</Text>
            <View style={{ height: 1, flex: 1, backgroundColor: colors.border }} />
          </View>
          <GoogleButton onError={setError} />
        </Surface>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>New to Ghar Sathi?</Text>
          <Link href="/(auth)/sign-up" style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>
            {t('signUp')}
          </Link>
        </View>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 14 }}>
          Your account is protected. Contact details stay private until you choose to share them.
        </Text>
      </ContentScroll>
    </Screen>
  );
}