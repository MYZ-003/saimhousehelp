import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { ActionButton, EmptyState, PageHeader, Screen, Surface } from '@/components/GharSathiUI';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/lib/locale';
import { useListConversations } from '@workspace/api-client-react';

export default function InboxScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t } = useLanguage();
  const conversations = useListConversations({
    query: { queryKey: ['list-conversations'], refetchInterval: 10000 },
  });

  return (
    <Screen>
      <PageHeader title={t('chats')} subtitle="Private conversations about work" />
      {conversations.isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : conversations.isError ? (
        <EmptyState
          icon="wifi-off"
          title="Couldn’t load conversations"
          description="Check your connection and try again."
          action={<ActionButton label={t('retry')} onPress={() => void conversations.refetch()} loading={conversations.isFetching} />}
        />
      ) : (conversations.data ?? []).length === 0 ? (
        <EmptyState icon="message-circle" title={t('noChats')} description="Accept an offer to start a conversation." />
      ) : (
        <FlatList
          data={conversations.data ?? []}
          keyExtractor={(item) => item.id}
          scrollEnabled={!!conversations.data?.length}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30, gap: 10 }}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open conversation with ${item.otherName}`}
              testID={`conversation-${item.id}`}
              onPress={() => router.push({ pathname: '/conversation/[conversationId]', params: { conversationId: item.id } })}
            >
              <Surface style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14 }}>
                <View style={{ width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}>
                  <Feather name="user" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 15 }}>{item.otherName}</Text>
                  <Text numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 13 }}>
                    {item.lastMessage ?? 'Conversation started'}
                  </Text>
                </View>
                {item.unreadCount > 0 ? (
                  <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.primaryForeground, fontSize: 11, fontWeight: '700' }}>{item.unreadCount}</Text>
                  </View>
                ) : null}
              </Surface>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}