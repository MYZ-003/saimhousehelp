import { Feather } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useQueryClient } from '@tanstack/react-query';
import { ActionButton, IconButton, InlineMessage, Screen } from '@/components/GharSathiUI';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/lib/locale';
import { useGetMessages, useGetMe, useSendMessage } from '@workspace/api-client-react';
import type { Message } from '@workspace/api-client-react';

function VoiceClip({ message }: { message: Message }) {
  const colors = useColors();
  const source = `data:${message.voiceMimeType ?? 'audio/m4a'};base64,${message.voiceBase64 ?? ''}`;
  const player = useAudioPlayer({ uri: source });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Play voice message, ${Math.round(message.durationSeconds ?? 0)} seconds`}
      onPress={() => player.play()}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8 }}
    >
      <Feather name="play-circle" size={23} color={colors.primary} />
      <Text style={{ color: colors.foreground, fontSize: 13 }}>Voice message · {Math.round(message.durationSeconds ?? 0)} sec</Text>
    </Pressable>
  );
}

function VoiceRecorderButton({
  onSend,
  onError,
}: {
  onSend: (base64: string, durationSeconds: number) => Promise<void>;
  onError: (message: string) => void;
}) {
  const colors = useColors();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const status = useAudioRecorderState(recorder);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (status.isRecording) {
        const durationSeconds = Math.max(1, Math.ceil(status.durationMillis / 1000));
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        if (durationSeconds > 60) {
          onError('Voice messages are limited to 60 seconds. Please record a shorter message.');
          return;
        }
        const uri = recorder.uri;
        if (!uri) throw new Error('The recording could not be saved.');
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        await onSend(base64, durationSeconds);
      } else {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          onError('Microphone access is needed for voice messages. You can still send text.');
          return;
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Could not record audio.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={status.isRecording ? 'Stop and send voice message' : 'Record voice message'}
      testID="record-voice"
      onPress={() => void toggle()}
      style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: status.isRecording ? colors.destructive : colors.accent, alignItems: 'center', justifyContent: 'center' }}
    >
      <Feather name={status.isRecording ? 'square' : 'mic'} size={19} color={status.isRecording ? colors.destructiveForeground : colors.primary} />
    </Pressable>
  );
}

export default function ConversationScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ conversationId: string }>();
  const conversationId = Array.isArray(params.conversationId) ? params.conversationId[0] : params.conversationId;
  const me = useGetMe();
  const messagesQuery = useGetMessages(conversationId ?? '', {
    query: {
      queryKey: ['get-messages', conversationId],
      enabled: !!conversationId,
      refetchInterval: 5000,
    },
  });
  const sendMessage = useSendMessage();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const currentUserId = me.data?.profile?.id;

  useEffect(() => {
    if (conversationId) void messagesQuery.refetch();
  }, [conversationId]);

  const sendText = async () => {
    const text = draft.trim();
    if (!text || !conversationId || sendMessage.isPending) return;
    setError('');
    try {
      await sendMessage.mutateAsync({
        conversationId,
        data: { text, voiceBase64: null, voiceMimeType: null, durationSeconds: null },
      });
      setDraft('');
      await queryClient.invalidateQueries();
    } catch (caught) {
      const apiError = caught as { response?: { data?: { error?: string } }; message?: string };
      setError(apiError.response?.data?.error ?? apiError.message ?? 'Message could not be sent.');
    }
  };

  const sendVoice = async (voiceBase64: string, durationSeconds: number) => {
    if (!conversationId) return;
    if (voiceBase64.length > 7000000) {
      setError('This recording is too large. Please record a shorter message.');
      return;
    }
    setError('');
    try {
      await sendMessage.mutateAsync({
        conversationId,
        data: {
          text: null,
          voiceBase64,
          voiceMimeType: 'audio/m4a',
          durationSeconds,
        },
      });
      await queryClient.invalidateQueries();
    } catch (caught) {
      const apiError = caught as { response?: { data?: { error?: string } }; message?: string };
      setError(apiError.response?.data?.error ?? apiError.message ?? 'Voice message could not be sent.');
    }
  };

  const data = [...(messagesQuery.data ?? [])].reverse();
  return (
    <Screen style={{ paddingBottom: 0 }}>
      <View style={{ minHeight: 54, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconButton icon="arrow-left" label="Back to conversations" onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '700' }}>Conversation</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Private to the two members</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {messagesQuery.isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : messagesQuery.isError ? (
          <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 14 }}>
            <InlineMessage text="This conversation could not be loaded. It may have been removed or you may not be a member." />
            <ActionButton label="Back to conversations" variant="outline" onPress={() => router.back()} />
          </View>
        ) : (
          <FlatList
            inverted
            data={data}
            keyExtractor={(item) => item.id}
            scrollEnabled={!!data.length}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 15, paddingVertical: 14, gap: 9 }}
            renderItem={({ item }) => {
              const mine = item.senderId === currentUserId;
              return (
                <View style={{ width: '100%', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                  <View
                    style={{
                      maxWidth: '84%',
                      minWidth: item.voiceBase64 ? 195 : undefined,
                      backgroundColor: mine ? colors.primary : colors.card,
                      borderColor: colors.border,
                      borderWidth: mine ? 0 : 1,
                      borderRadius: 18,
                      paddingHorizontal: 13,
                      paddingVertical: 9,
                    }}
                  >
                    {item.text ? <Text style={{ color: mine ? colors.primaryForeground : colors.foreground, fontSize: 14, lineHeight: 20 }}>{item.text}</Text> : null}
                    {item.voiceBase64 ? (
                      Platform.OS === 'web' ? (
                        <Text style={{ color: mine ? colors.primaryForeground : colors.foreground, fontSize: 13 }}>
                          Voice message · open on your phone to play
                        </Text>
                      ) : (
                        <VoiceClip message={item} />
                      )
                    ) : null}
                    <Text style={{ color: mine ? colors.primaryForeground : colors.mutedForeground, opacity: 0.72, fontSize: 10, textAlign: 'right', marginTop: 4 }}>
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        <View style={{ paddingHorizontal: 12, paddingTop: 9, paddingBottom: Platform.OS === 'web' ? 34 : 12, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 }}>
          <InlineMessage text={error} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            {Platform.OS === 'web' ? null : <VoiceRecorderButton onSend={sendVoice} onError={setError} />}
            <TextInput
              accessibilityLabel={t('typeMessage')}
              testID="message-input"
              value={draft}
              onChangeText={setDraft}
              placeholder={t('typeMessage')}
              placeholderTextColor={colors.mutedForeground}
              multiline
              maxLength={2000}
              returnKeyType="default"
              style={{ flex: 1, maxHeight: 115, minHeight: 46, borderRadius: 16, backgroundColor: colors.card, borderColor: colors.input, borderWidth: 1, color: colors.foreground, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('send')}
              testID="send-message"
              onPress={() => void sendText()}
              disabled={!draft.trim() || sendMessage.isPending}
              style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: colors.primary, opacity: !draft.trim() || sendMessage.isPending ? 0.55 : 1, alignItems: 'center', justifyContent: 'center' }}
            >
              {sendMessage.isPending ? <ActivityIndicator color={colors.primaryForeground} /> : <Feather name="send" size={18} color={colors.primaryForeground} />}
            </Pressable>
          </View>
          {Platform.OS === 'web' ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: 'center' }}>
              Voice messages are available in the mobile app.
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}