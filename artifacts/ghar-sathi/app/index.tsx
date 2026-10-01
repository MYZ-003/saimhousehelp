import { useAuth } from '@clerk/expo';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { ActionButton, BrandHeader, InlineMessage, Screen } from '@/components/GharSathiUI';
import { useColors } from '@/hooks/useColors';
import { useGetMe } from '@workspace/api-client-react';

export default function EntryScreen() {
  const router = useRouter();
  const colors = useColors();
  const { isLoaded, isSignedIn } = useAuth();
  const me = useGetMe({
    query: { queryKey: ['get-me'], enabled: isLoaded && !!isSignedIn, retry: 1 },
  });

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace('/(auth)/sign-in');
    if (me.data?.profile) router.replace('/(tabs)');
    if (me.data && !me.data.profile) router.replace('/onboarding');
  }, [isLoaded, isSignedIn, me.data, router]);

  if (!isLoaded || (isSignedIn && me.isLoading)) {
    return (
      <Screen style={{ alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Opening your secure account…</Text>
      </Screen>
    );
  }

  if (!isSignedIn) return null;

  if (me.isError) {
    return (
      <Screen style={{ paddingHorizontal: 24, justifyContent: 'center' }}>
        <View style={{ gap: 18 }}>
          <BrandHeader eyebrow="A better match for every home" />
          <Text style={{ color: colors.foreground, fontSize: 26, lineHeight: 33, fontWeight: '700' }}>
            Your account is ready. Marketplace setup is waiting for its database.
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 15, lineHeight: 23 }}>
            Add your Supabase connection and apply the included migration to finish saving profiles, offers, and messages.
          </Text>
          <InlineMessage text="The API is responding, but the marketplace database is not configured yet." tone="info" />
          <ActionButton label="Continue profile setup" icon="arrow-right" onPress={() => router.replace('/onboarding')} />
          <ActionButton label="Retry connection" variant="outline" onPress={() => me.refetch()} loading={me.isFetching} />
        </View>
      </Screen>
    );
  }

  return null;
}