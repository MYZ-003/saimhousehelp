import { Feather } from '@expo/vector-icons';
import { useClerk, useUser } from '@clerk/expo';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { ActionButton, Chip, ContentScroll, InlineMessage, PageHeader, Screen, StatusPill, Surface } from '@/components/GharSathiUI';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/lib/locale';
import { useDeleteMe, useGetMe } from '@workspace/api-client-react';

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { t, language, setLanguage } = useLanguage();
  const profileQuery = useGetMe();
  const deleteAccount = useDeleteMe();
  const [error, setError] = useState('');
  const profile = profileQuery.data?.profile;

  const logout = async () => {
    await signOut();
    queryClient.clear();
    router.replace('/(auth)/sign-in');
  };

  const removeAccount = () => {
    Alert.alert(t('deleteAccount'), t('deleteConfirm'), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: t('deleteAccount'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setError('');
            try {
              await deleteAccount.mutateAsync();
              if (user) {
                await user.delete();
              }
              queryClient.clear();
              await signOut().catch(() => undefined);
              router.replace('/(auth)/sign-in');
            } catch (caught) {
              const apiError = caught as { response?: { data?: { error?: string } }; message?: string };
              setError(apiError.response?.data?.error ?? apiError.message ?? 'Could not delete your account.');
            }
          })();
        },
      },
    ]);
  };

  if (!profile) {
    return (
      <Screen>
        <PageHeader title={t('profile')} />
        <ContentScroll>
          <InlineMessage text={error} />
          <ActionButton label="Finish profile setup" onPress={() => router.replace('/onboarding')} />
          <ActionButton label={t('signOut')} variant="outline" onPress={() => void logout()} />
        </ContentScroll>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader title={t('profile')} subtitle="Your details and preferences" />
      <ContentScroll>
        <Surface>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
            <View style={{ width: 58, height: 58, borderRadius: 20, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' }}>
              <Feather name="user" size={26} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: colors.foreground, fontSize: 19, fontWeight: '700' }}>{profile.fullName}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                {profile.role === 'client' ? 'Client' : 'Household helper'} · {profile.city}
              </Text>
            </View>
          </View>
          <StatusPill status={profile.verificationStatus} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label={profile.area} />
            {profile.serviceHoursMin !== null && profile.serviceHoursMax !== null ? (
              <Chip label={`${profile.serviceHoursMin}–${profile.serviceHoursMax} hours`} />
            ) : null}
            {profile.rateMinPkr !== null ? <Chip label={`From ₨ ${profile.rateMinPkr}/hr`} /> : null}
          </View>
          <ActionButton
            label="Edit profile"
            icon="edit-2"
            variant="outline"
            onPress={() => router.push('/onboarding')}
          />
        </Surface>

        <Surface>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '700' }}>{t('language')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label="English" selected={language === 'en'} onPress={() => setLanguage('en')} />
            <Chip label="اردو" selected={language === 'ur'} onPress={() => setLanguage('ur')} />
            <Chip label="Roman Urdu" selected={language === 'romanUrdu'} onPress={() => setLanguage('romanUrdu')} />
          </View>
        </Surface>

        <Surface>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '700' }}>Privacy & account</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 20 }}>
            Your precise coordinates are only used for nearby matching. Other members see your area and an approximate distance.
          </Text>
          <InlineMessage text={error} />
          <ActionButton label={t('signOut')} icon="log-out" variant="outline" onPress={() => void logout()} />
          <ActionButton label={t('deleteAccount')} icon="trash-2" variant="destructive" onPress={removeAccount} loading={deleteAccount.isPending} />
        </Surface>
      </ContentScroll>
    </Screen>
  );
}