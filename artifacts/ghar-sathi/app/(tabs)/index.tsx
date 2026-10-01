import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  Text,
  View,
} from 'react-native';
import { ActionButton, Chip, ContentScroll, EmptyState, IconButton, InlineMessage, InputField, PageHeader, Screen, StatusPill, Surface } from '@/components/GharSathiUI';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/lib/locale';
import { useCreateSwipe, useFindHelpers, useGetMe } from '@workspace/api-client-react';

function money(value: number) {
  return `₨ ${new Intl.NumberFormat('en-PK').format(value)}`;
}

export default function DiscoverScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t } = useLanguage();
  const profileQuery = useGetMe();
  const profile = profileQuery.data?.profile;
  const isClient = profile?.role === 'client';
  const helpersQuery = useFindHelpers(
    { radiusKm: profile?.radiusKm ?? 10 },
    {
      query: {
        queryKey: ['find-helpers', profile?.radiusKm ?? 10],
        enabled: !!profile && isClient,
        refetchInterval: 30000,
      },
    },
  );
  const createSwipe = useCreateSwipe();
  const helpers = helpersQuery.data ?? [];
  const [seen, setSeen] = useState<string[]>([]);
  const [offer, setOffer] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(String(profile?.serviceHoursMin ?? 2));
  const [workType, setWorkType] = useState('');
  const [error, setError] = useState('');
  const pan = useRef(new Animated.ValueXY()).current;
  const swipeRef = useRef<(direction: 'left' | 'right') => void>(() => undefined);
  const helper = helpers.find((item) => !seen.includes(item.id));
  const selectedWork = workType || helper?.workTypes[0] || profile?.workTypes[0] || 'Household help';

  const swipe = async (direction: 'left' | 'right') => {
    if (!helper || createSwipe.isPending) return;
    setError('');
    if (direction === 'right' && (!Number.isFinite(Number(offer)) || Number(offer) <= 0)) {
      setError('Enter your total PKR offer before liking this helper.');
      return;
    }
    try {
      await createSwipe.mutateAsync({
        data: {
          helperId: helper.id,
          direction,
          offerAmountPkr: direction === 'right' ? Math.round(Number(offer)) : null,
          workType: selectedWork,
          durationHours: Math.max(0.5, Math.min(24, Number(duration) || 2)),
          workDescription: description.trim(),
        },
      });
      setSeen((current) => [...current, helper.id]);
      setOffer('');
      setDescription('');
      setWorkType('');
    } catch (caught) {
      const apiError = caught as { response?: { data?: { error?: string } }; message?: string };
      setError(apiError.response?.data?.error ?? apiError.message ?? 'Could not send your offer.');
    }
  };
  swipeRef.current = (direction) => {
    void swipe(direction);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx > 110) {
            Animated.timing(pan, { toValue: { x: 450, y: gesture.dy }, duration: 180, useNativeDriver: false }).start(() => {
              pan.setValue({ x: 0, y: 0 });
              swipeRef.current('right');
            });
          } else if (gesture.dx < -110) {
            Animated.timing(pan, { toValue: { x: -450, y: gesture.dy }, duration: 180, useNativeDriver: false }).start(() => {
              pan.setValue({ x: 0, y: 0 });
              swipeRef.current('left');
            });
          } else {
            Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
          }
        },
      }),
    [pan],
  );

  if (!profile) {
    return (
      <Screen>
        <EmptyState
          icon="user"
          title="Finish your profile first"
          description="A complete profile helps Ghar Sathi show the right local matches."
          action={<ActionButton label="Set up profile" onPress={() => router.replace('/onboarding')} />}
        />
      </Screen>
    );
  }

  if (!isClient) {
    return (
      <Screen>
        <PageHeader title={t('requests')} subtitle="Your work requests and new client offers" />
        <ContentScroll>
          <EmptyState
            icon="briefcase"
            title="Your service profile is live"
            description="Client offers will appear in Requests. Keep your skills, visit hours, and rates up to date."
            action={<ActionButton label="View requests" onPress={() => router.push('/(tabs)/requests')} />}
          />
        </ContentScroll>
      </Screen>
    );
  }

  if (helpersQuery.isLoading) {
    return (
      <Screen>
        <PageHeader title={t('discover')} subtitle={t('discoverIntro')} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.mutedForeground }}>Finding nearby helpers…</Text>
        </View>
      </Screen>
    );
  }

  if (helpersQuery.isError) {
    return (
      <Screen>
        <PageHeader title={t('discover')} subtitle={t('discoverIntro')} />
        <EmptyState
          icon="wifi-off"
          title="Couldn’t load nearby helpers"
          description="Check your connection and try again."
          action={<ActionButton label={t('retry')} onPress={() => helpersQuery.refetch()} loading={helpersQuery.isFetching} />}
        />
      </Screen>
    );
  }

  if (!profile.latitude || !profile.longitude) {
    return (
      <Screen>
        <PageHeader title={t('discover')} subtitle={t('discoverIntro')} />
        <EmptyState
          icon="map-pin"
          title="Add your location to find nearby help"
          description="Your exact coordinates stay private. Helpers only see an approximate distance and your area."
          action={<ActionButton label="Update location" onPress={() => router.push('/onboarding')} />}
        />
      </Screen>
    );
  }

  if (!helper) {
    return (
      <Screen>
        <PageHeader title={t('discover')} subtitle={t('discoverIntro')} />
        <EmptyState
          icon="search"
          title={seen.length ? 'You’ve seen these helpers' : t('noHelpers')}
          description={seen.length ? 'Refresh to check for new profiles.' : 'Try a larger search radius or check back later.'}
          action={
            <View style={{ gap: 10, width: '100%' }}>
              {seen.length ? <ActionButton label="Refresh matches" onPress={() => setSeen([])} /> : null}
              <ActionButton label="Change search radius" variant="outline" onPress={() => router.push('/onboarding')} />
            </View>
          }
        />
      </Screen>
    );
  }

  const helperRate =
    helper.rateMinPkr !== null && helper.rateMaxPkr !== null
      ? `${money(helper.rateMinPkr)}–${money(helper.rateMaxPkr)}/hr`
      : helper.rateMinPkr !== null
        ? `From ${money(helper.rateMinPkr)}/hr`
        : 'Rate on request';
  const distance = helper.distanceKm < 1 ? 'Under 1 km away' : `About ${helper.distanceKm.toFixed(1)} km away`;

  return (
    <Screen>
      <PageHeader
        title={t('discover')}
        subtitle={`${profile.city} · ${profile.area}`}
        right={<IconButton icon="bell" label={t('alerts')} onPress={() => router.push('/(tabs)/alerts')} />}
      />
      <ContentScroll style={{ gap: 13 }}>
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 24,
              padding: 20,
              gap: 13,
              transform: pan.getTranslateTransform(),
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 48, height: 48, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="user" size={23} color={colors.primary} />
              </View>
              <View>
                <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: '700' }}>{helper.fullName}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 3 }}>{helper.area}, {helper.city}</Text>
              </View>
            </View>
            <StatusPill status={helper.verificationStatus} />
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label={distance} />
            <Chip label={helperRate} />
            {helper.serviceHoursMin !== null && helper.serviceHoursMax !== null ? (
              <Chip label={`Visits ${helper.serviceHoursMin}–${helper.serviceHoursMax} hrs`} />
            ) : null}
          </View>

          <View style={{ gap: 7 }}>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>Services</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
              {[...new Set([...helper.workTypes, ...helper.skills])].slice(0, 8).map((skill) => (
                <Chip key={skill} label={skill} selected={selectedWork === skill} onPress={() => setWorkType(skill)} />
              ))}
            </View>
          </View>

          {helper.about || helper.natureOfWork ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 21 }}>
              {helper.about || helper.natureOfWork}
            </Text>
          ) : null}

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 2 }} />
          <InputField
            label={t('offerAmount')}
            value={offer}
            onChangeText={setOffer}
            keyboardType="number-pad"
            placeholder="For the full visit"
            testID="offer-amount"
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <InputField label={t('duration')} value={duration} onChangeText={setDuration} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <InputField label="Work type" value={selectedWork} editable={false} />
            </View>
          </View>
          <InputField
            label="Work details (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Briefly describe the work"
            maxLength={500}
          />
          <InlineMessage text={error} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: 'center' }}>
            Swipe left to pass, or right to send your offer.
          </Text>
        </Animated.View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <ActionButton
              label={t('pass')}
              icon="x"
              variant="outline"
              onPress={() => void swipe('left')}
              disabled={createSwipe.isPending}
              testID="pass-helper"
            />
          </View>
          <View style={{ flex: 1.3 }}>
            <ActionButton
              label={t('sendOffer')}
              icon="heart"
              onPress={() => void swipe('right')}
              loading={createSwipe.isPending}
              testID="send-offer"
            />
          </View>
        </View>
      </ContentScroll>
    </Screen>
  );
}
