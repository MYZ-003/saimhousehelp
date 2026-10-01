import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { ActionButton, EmptyState, InlineMessage, PageHeader, Screen, Surface } from '@/components/GharSathiUI';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/lib/locale';
import { useListNotifications, useMarkNotificationRead } from '@workspace/api-client-react';

export default function AlertsScreen() {
  const colors = useColors();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const notifications = useListNotifications({
    query: { queryKey: ['list-notifications'], refetchInterval: 15000 },
  });
  const markRead = useMarkNotificationRead();
  const [error, setError] = useState('');

  const read = async (id: string) => {
    setError('');
    try {
      await markRead.mutateAsync({ notificationId: id });
      await queryClient.invalidateQueries();
    } catch (caught) {
      const apiError = caught as { response?: { data?: { error?: string } }; message?: string };
      setError(apiError.response?.data?.error ?? apiError.message ?? 'Could not mark this alert as read.');
    }
  };

  return (
    <Screen>
      <PageHeader title={t('alerts')} subtitle="Offers and account updates" />
      {notifications.isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : notifications.isError ? (
        <EmptyState
          icon="wifi-off"
          title="Couldn’t load alerts"
          description="Check your connection and try again."
          action={<ActionButton label={t('retry')} onPress={() => void notifications.refetch()} loading={notifications.isFetching} />}
        />
      ) : (notifications.data ?? []).length === 0 ? (
        <EmptyState icon="bell" title={t('noAlerts')} description="Updates about offers and conversations will appear here." />
      ) : (
        <FlatList
          data={notifications.data ?? []}
          keyExtractor={(item) => item.id}
          scrollEnabled={!!notifications.data?.length}
          ListHeaderComponent={error ? <InlineMessage text={error} /> : null}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30, gap: 10 }}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.title}${item.read ? '' : ', unread'}`}
              testID={`notification-${item.id}`}
              onPress={() => !item.read && void read(item.id)}
            >
              <Surface
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 12,
                  borderColor: item.read ? colors.border : colors.primary,
                  backgroundColor: item.read ? colors.card : colors.accent,
                }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name={item.kind.includes('offer') ? 'tag' : 'bell'} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: colors.foreground, fontWeight: item.read ? '600' : '700', fontSize: 14 }}>{item.title}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>{item.body}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{new Date(item.createdAt).toLocaleString()}</Text>
                </View>
                {!item.read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 5 }} /> : null}
              </Surface>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}