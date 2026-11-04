import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { ActionButton, Chip, ContentScroll, InlineMessage, InputField, LanguageSwitcher, Screen, Surface } from '@/components/GharSathiUI';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/lib/locale';
import { useGetMe, useSaveMyProfile } from '@workspace/api-client-react';

type Role = 'client' | 'helper';
const SERVICES = ['Cleaning', 'Cooking', 'Laundry & ironing', 'Elder care', 'Child care', 'Kitchen help'];
const SKILLS = ['Cleaning', 'Cooking', 'Laundry & ironing', 'Elder care', 'Child care', 'Kitchen help'];

export default function OnboardingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const colors = useColors();
  const { t, language, setLanguage } = useLanguage();
  const profileQuery = useGetMe();
  const saveProfile = useSaveMyProfile();
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [role, setRole] = useState<Role>('client');
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [radiusKm, setRadiusKm] = useState('10');
  const [hoursMin, setHoursMin] = useState('2');
  const [hoursMax, setHoursMax] = useState('4');
  const [rateMin, setRateMin] = useState('');
  const [rateMax, setRateMax] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationMessage, setLocationMessage] = useState('');
  const [error, setError] = useState('');
  const profile = profileQuery.data?.profile;

  useEffect(() => {
    if (profileLoaded || profileQuery.isLoading) return;
    if (profile) {
      setRole(profile.role);
      setFullName(profile.fullName);
      setCity(profile.city);
      setArea(profile.area);
      setRadiusKm(String(profile.radiusKm));
      setHoursMin(String(profile.serviceHoursMin ?? 2));
      setHoursMax(String(profile.serviceHoursMax ?? 4));
      setRateMin(profile.rateMinPkr === null ? '' : String(profile.rateMinPkr));
      setRateMax(profile.rateMaxPkr === null ? '' : String(profile.rateMaxPkr));
      setServices(profile.role === 'helper' ? profile.skills : profile.workTypes);
      setLatitude(profile.latitude);
      setLongitude(profile.longitude);
      setLanguage(profile.language);
    }
    setProfileLoaded(true);
  }, [profile, profileLoaded, profileQuery.isLoading, setLanguage]);

  const toggleService = (service: string) => {
    setServices((current) =>
      current.includes(service) ? current.filter((item) => item !== service) : [...current, service],
    );
  };

  const getLocation = async () => {
    setLocationMessage('');
    try {
      if (Platform.OS === 'web') {
        if (!navigator.geolocation) {
          setLocationMessage('Location is unavailable in this browser. Enter your city and area instead.');
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLatitude(position.coords.latitude);
            setLongitude(position.coords.longitude);
            setLocationMessage('Location saved privately for nearby matching.');
          },
          () => setLocationMessage('Location was not shared. You can continue using your city and area.'),
          { enableHighAccuracy: false, timeout: 10000 },
        );
        return;
      }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        if (!permission.canAskAgain) {
          Alert.alert('Location access is off', 'You can enable it in settings, or continue with your city and area.', [
            { text: 'Continue', style: 'cancel' },
            { text: 'Open settings', onPress: () => Linking.openSettings().catch(() => undefined) },
          ]);
        } else {
          setLocationMessage('Location was not shared. You can continue using your city and area.');
        }
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLatitude(position.coords.latitude);
      setLongitude(position.coords.longitude);
      setLocationMessage('Location saved privately for nearby matching.');
    } catch {
      setLocationMessage('Location is unavailable. Enter your city and area instead.');
    }
  };

  const submit = async () => {
    setError('');
    const minimumHours = Number(hoursMin);
    const maximumHours = Number(hoursMax);
    const minimumRate = rateMin.trim() ? Number(rateMin) : null;
    const maximumRate = rateMax.trim() ? Number(rateMax) : null;
    if (minimumHours > maximumHours) {
      setError('The minimum visit duration must be less than or equal to the maximum.');
      return;
    }
    if (minimumRate !== null && maximumRate !== null && minimumRate > maximumRate) {
      setError('The minimum rate must be less than or equal to the maximum.');
      return;
    }
    if (services.length === 0) {
      setError('Choose at least one type of household work.');
      return;
    }
    try {
      await saveProfile.mutateAsync({
        data: {
          role,
          fullName: fullName.trim(),
          language,
          city: city.trim(),
          area: area.trim(),
          latitude,
          longitude,
          radiusKm: Math.max(1, Math.min(100, Number(radiusKm) || 10)),
          skills: role === 'helper' ? services : [],
          workTypes: services,
          serviceHoursMin: minimumHours,
          serviceHoursMax: maximumHours,
          rateMinPkr: minimumRate,
          rateMaxPkr: maximumRate,
          natureOfWork: role === 'helper' ? services.join(', ') : null,
          about: null,
        },
      });
      await queryClient.invalidateQueries();
      router.replace('/');
    } catch (caught) {
      const apiError = caught as { message?: string; response?: { data?: { error?: string } } };
      setError(
        apiError?.response?.data?.error ??
          'We could not save your profile. Check your connection and try again; your details are still on this screen.',
      );
    }
  };

  return (
    <Screen>
      <ContentScroll style={{ paddingTop: 12, paddingBottom: 42 }}>
        <LanguageSwitcher />
        <View style={{ gap: 7 }}>
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 }}>
            MAID.com · SETUP
          </Text>
          <Text style={{ color: colors.foreground, fontSize: 28, lineHeight: 34, fontWeight: '700' }}>
            Let’s set up your profile
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 21 }}>
            Your exact location stays private. Only your area and an approximate distance are shown to others.
          </Text>
        </View>

        <Surface style={{ marginTop: 8 }}>
          <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '700' }}>
            {t('rolePrompt')}
          </Text>
          <View style={{ gap: 10 }}>
            {(['client', 'helper'] as Role[]).map((value) => {
              const selected = role === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  testID={`role-${value}`}
                  onPress={() => setRole(value)}
                  style={{
                    backgroundColor: selected ? colors.accent : colors.card,
                    borderColor: selected ? colors.primary : colors.border,
                    borderWidth: 1,
                    borderRadius: 15,
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? colors.accentForeground : colors.foreground,
                      fontSize: 15,
                      fontWeight: '700',
                    }}
                  >
                    {value === 'client' ? t('client') : t('helper')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <InputField label={t('fullName')} value={fullName} onChangeText={setFullName} autoComplete="name" textContentType="name" testID="profile-name" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <InputField label={t('city')} value={city} onChangeText={setCity} autoCapitalize="words" testID="profile-city" />
            </View>
            <View style={{ flex: 1 }}>
              <InputField label={t('area')} value={area} onChangeText={setArea} autoCapitalize="words" testID="profile-area" />
            </View>
          </View>
          <ActionButton label={t('useLocation')} icon="map-pin" variant="outline" onPress={getLocation} compact />
          <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
            {locationMessage || (latitude !== null ? 'Location saved privately for nearby matching.' : 'Location is optional; city and area are required.')}
          </Text>
          {role === 'client' ? (
            <InputField
              label="Search radius (km)"
              value={radiusKm}
              onChangeText={setRadiusKm}
              keyboardType="number-pad"
              testID="profile-radius"
            />
          ) : null}
          <View style={{ gap: 9 }}>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '600' }}>
              {role === 'helper' ? 'Services you provide' : 'What kind of help do you need?'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(role === 'helper' ? SKILLS : SERVICES).map((service) => (
                <Chip
                  key={service}
                  label={service}
                  selected={services.includes(service)}
                  onPress={() => toggleService(service)}
                  testID={`service-${service.toLowerCase().replace(/[^a-z]+/g, '-')}`}
                />
              ))}
            </View>
          </View>
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '600' }}>
            {role === 'helper' ? 'Typical visit duration (hours)' : 'Expected work duration (hours)'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <InputField label="From" value={hoursMin} onChangeText={setHoursMin} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <InputField label="To" value={hoursMax} onChangeText={setHoursMax} keyboardType="number-pad" />
            </View>
          </View>
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '600' }}>
            {role === 'helper' ? 'Hourly rate in PKR (optional)' : 'Hourly budget in PKR (optional)'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <InputField label="Minimum" value={rateMin} onChangeText={setRateMin} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <InputField label="Maximum" value={rateMax} onChangeText={setRateMax} keyboardType="number-pad" />
            </View>
          </View>
          <InlineMessage text={error} />
          <ActionButton
            label={t('saveProfile')}
            icon="arrow-right"
            onPress={submit}
            loading={saveProfile.isPending}
            disabled={fullName.trim().length < 2 || city.trim().length < 2 || area.trim().length < 2}
            testID="save-profile"
          />
        </Surface>
      </ContentScroll>
    </Screen>
  );
}