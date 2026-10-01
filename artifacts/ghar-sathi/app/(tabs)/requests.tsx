import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { ActionButton, ContentScroll, EmptyState, InlineMessage, InputField, PageHeader, Screen, Surface } from '@/components/GharSathiUI';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/lib/locale';
import { useDecideOffer, useListOffers } from '@workspace/api-client-react';
import type { Offer } from '@workspace/api-client-react';

function money(value: number) {
  return `₨ ${new Intl.NumberFormat('en-PK').format(value)}`;
}

function OfferCard({
  offer,
  onDecide,
  busy,
}: {
  offer: Offer;
  onDecide: (action: 'accept' | 'decline' | 'counter', amount?: number) => Promise<void>;
  busy: boolean;
}) {
  const colors = useColors();
  const [counter, setCounter] = useState(String(offer.counterAmountPkr ?? offer.amountPkr));
  const canRespond = offer.myRole === 'helper' && offer.status === 'pending';
  const canAcceptCounter = offer.myRole === 'client' && offer.status === 'countered';
  const statusLabel =
    offer.status === 'accepted' ? 'Accepted' : offer.status === 'declined' ? 'Declined' :
      offer.status === 'countered' ? 'Counter offer' : 'Awaiting response';

  return (
    <Surface>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: '700' }}>{offer.otherName}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
            {offer.myRole === 'helper' ? 'Client offer' : 'Your offer'} · {new Date(offer.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Feather name="clock" size={14} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>{offer.durationHours} hr</Text>
        </View>
      </View>

      <View style={{ backgroundColor: colors.accent, borderRadius: 16, padding: 14, gap: 5 }}>
        <Text style={{ color: colors.accentForeground, fontSize: 12, fontWeight: '600' }}>{offer.workType}</Text>
        <Text style={{ color: colors.foreground, fontSize: 23, fontWeight: '700' }}>
          {money(offer.counterAmountPkr ?? offer.amountPkr)}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
          {offer.counterAmountPkr ? `Original offer ${money(offer.amountPkr)}` : 'Total for this visit'}
        </Text>
      </View>

      {offer.workDescription ? <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 20 }}>{offer.workDescription}</Text> : null}
      <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: '600' }}>{statusLabel}</Text>

      {canRespond ? (
        <>
          <InputField label="Your counter offer (PKR)" value={counter} onChangeText={setCounter} keyboardType="number-pad" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <ActionButton label="Decline" variant="outline" onPress={() => void onDecide('decline')} loading={busy} compact />
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton label="Counter" variant="secondary" onPress={() => void onDecide('counter', Number(counter))} loading={busy} compact />
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton label="Accept" onPress={() => void onDecide('accept')} loading={busy} compact />
            </View>
          </View>
        </>
      ) : canAcceptCounter ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <ActionButton label="Decline" variant="outline" onPress={() => void onDecide('decline')} loading={busy} compact />
          </View>
          <View style={{ flex: 1.4 }}>
            <ActionButton label="Accept counter" onPress={() => void onDecide('accept')} loading={busy} compact />
          </View>
        </View>
      ) : null}
    </Surface>
  );
}

export default function RequestsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const offersQuery = useListOffers({
    query: { queryKey: ['list-offers'], refetchInterval: 15000 },
  });
  const decision = useDecideOffer();
  const [error, setError] = useState('');

  const decide = async (offer: Offer, action: 'accept' | 'decline' | 'counter', amount?: number) => {
    setError('');
    if (action === 'counter' && (!amount || amount < 1 || amount > 1000000)) {
      setError('Enter a counter offer from 1 to 1,000,000 PKR.');
      return;
    }
    try {
      const result = await decision.mutateAsync({
        offerId: offer.id,
        data: action === 'counter' ? { action, counterAmountPkr: amount } : { action },
      });
      await queryClient.invalidateQueries();
      if (result.conversationId) {
        router.push({ pathname: '/conversation/[conversationId]', params: { conversationId: result.conversationId } });
      }
    } catch (caught) {
      const apiError = caught as { response?: { data?: { error?: string } }; message?: string };
      setError(apiError.response?.data?.error ?? apiError.message ?? 'Could not update this offer.');
    }
  };

  if (offersQuery.isLoading) {
    return (
      <Screen>
        <PageHeader title={t('requests')} subtitle="Offers for household work" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (offersQuery.isError) {
    return (
      <Screen>
        <PageHeader title={t('requests')} subtitle="Offers for household work" />
        <EmptyState icon="wifi-off" title="Couldn’t load offers" description="Check your connection, then try again." action={<ActionButton label={t('retry')} onPress={() => offersQuery.refetch()} />} />
      </Screen>
    );
  }

  const offers = offersQuery.data ?? [];
  return (
    <Screen>
      <PageHeader title={t('requests')} subtitle="Offers for household work" />
      <ContentScroll>
        <InlineMessage text={error} />
        {offers.length ? (
          offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              onDecide={(action, amount) => decide(offer, action, amount)}
              busy={decision.isPending}
            />
          ))
        ) : (
          <EmptyState
            icon="inbox"
            title={t('noRequests')}
            description="New client offers and responses will show up here."
          />
        )}
      </ContentScroll>
    </Screen>
  );
}