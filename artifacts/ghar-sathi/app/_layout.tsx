import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ClerkLoaded, ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { setAuthTokenGetter, setBaseUrl, setFetchInterceptor } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LanguageProvider } from '@/lib/locale';
import { DemoAuthProvider } from '@/lib/demo-auth';
import { handleDemoApiRequest } from '@/lib/demo-api';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const demoMode = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  (process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : undefined);
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

if (demoMode && !__DEV__) {
  throw new Error('Local demo mode is only available in Expo development builds.');
}
if (!demoMode && !apiBaseUrl) {
  throw new Error('Missing EXPO_PUBLIC_API_URL. Set the API address in the project .env file.');
}
if (!demoMode && !publishableKey) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Add the Clerk publishable key to the project .env file.');
}

setBaseUrl(demoMode ? 'http://maid-com-demo.local' : apiBaseUrl ?? null);
setFetchInterceptor(demoMode ? handleDemoApiRequest : null);

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="conversation/[conversationId]" />
    </Stack>
  );
}

function ApiAuthBridge() {
  const { getToken, userId } = useAuth();
  const previousUserId = React.useRef(userId);

  useEffect(() => {
    // Expo's native runtime has no browser cookie jar, so it authenticates API
    // requests with a Clerk bearer token. The web build uses same-origin cookies.
    setAuthTokenGetter(Platform.OS === 'web' ? null : () => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  useEffect(() => {
    if (previousUserId.current !== userId) {
      queryClient.clear();
      previousUserId.current = userId;
    }
  }, [userId]);

  return <AppShell />;
}

function AppShell() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <LanguageProvider>
          <RootLayoutNav />
        </LanguageProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function DemoApp() {
  return (
    <DemoAuthProvider>
      <AppShell />
    </DemoAuthProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          {demoMode ? (
            <DemoApp />
          ) : (
            <ClerkProvider
              publishableKey={publishableKey!}
              tokenCache={tokenCache}
              proxyUrl={proxyUrl}
            >
              <ClerkLoaded>
                <ApiAuthBridge />
              </ClerkLoaded>
            </ClerkProvider>
          )}
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
