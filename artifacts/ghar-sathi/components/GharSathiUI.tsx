import { Feather } from '@expo/vector-icons';
import React, { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/lib/locale';

export function Screen({ children, style }: { children: ReactNode; style?: object }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
          paddingTop: Platform.OS === 'web' ? 67 : insets.top,
          paddingBottom: Platform.OS === 'web' ? 34 : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <Image
      source={require('../assets/images/icon.png')}
      style={{ width: size, height: size, borderRadius: size * 0.24 }}
      accessibilityLabel="Ghar Sathi"
    />
  );
}

export function BrandHeader({ eyebrow }: { eyebrow?: string }) {
  const colors = useColors();
  const { t } = useLanguage();
  return (
    <View style={styles.brandRow}>
      <BrandMark />
      <View style={{ flex: 1 }}>
        <Text style={[styles.brandName, { color: colors.foreground }]}>{t('brand')}</Text>
        {!!eyebrow && <Text style={[styles.brandEyebrow, { color: colors.mutedForeground }]}>{eyebrow}</Text>}
      </View>
    </View>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.pageHeader}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Surface({ children, style }: { children: ReactNode; style?: object }) {
  const colors = useColors();
  return (
    <View style={[styles.surface, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  testID,
  accessibilityLabel,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'quiet';
  icon?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  compact?: boolean;
}) {
  const colors = useColors();
  const palette = {
    primary: { bg: colors.primary, fg: colors.primaryForeground, border: colors.primary },
    secondary: { bg: colors.secondary, fg: colors.secondaryForeground, border: colors.secondary },
    outline: { bg: 'transparent', fg: colors.foreground, border: colors.border },
    destructive: { bg: colors.destructive, fg: colors.destructiveForeground, border: colors.destructive },
    quiet: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled || loading ? 0.55 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.buttonContent}>
          {icon ? <Feather name={icon} size={17} color={palette.fg} /> : null}
          <Text style={[styles.buttonText, { color: palette.fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  color,
  testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  label: string;
  color?: string;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.55 : 1 }]}
    >
      <Feather name={icon} size={21} color={color ?? colors.foreground} />
    </Pressable>
  );
}

export function InputField({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  const colors = useColors();
  const { isRTL } = useLanguage();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>
        {label}
      </Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.mutedForeground}
        accessibilityLabel={props.accessibilityLabel ?? label}
        style={[
          styles.input,
          {
            backgroundColor: colors.card,
            borderColor: colors.input,
            color: colors.foreground,
            textAlign: isRTL ? 'right' : props.textAlign ?? 'left',
          },
          props.multiline && styles.multiline,
          props.style,
        ]}
      />
      {hint ? <Text style={[styles.hint, { color: colors.mutedForeground }]}>{hint}</Text> : null}
    </View>
  );
}

export function Chip({
  label,
  selected = false,
  onPress,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected } : undefined}
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.accent : colors.secondary,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.accentForeground : colors.secondaryForeground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function StatusPill({ status }: { status: string }) {
  const colors = useColors();
  const { t } = useLanguage();
  const verified = status === 'verified';
  const pending = status === 'pending';
  const color = verified ? '#147D54' : pending ? colors.primary : colors.mutedForeground;
  const text = verified ? t('verified') : pending ? t('pending') : t('unverified');
  return (
    <View style={[styles.statusPill, { backgroundColor: verified ? '#E5F5EC' : colors.muted }]}>
      <Feather name={verified ? 'check-circle' : pending ? 'clock' : 'shield'} size={13} color={color} />
      <Text style={[styles.statusText, { color }]}>{text}</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}>
        <Feather name={icon} size={25} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      {description ? <Text style={[styles.emptyDescription, { color: colors.mutedForeground }]}>{description}</Text> : null}
      {action}
    </View>
  );
}

export function InlineMessage({
  text,
  tone = 'error',
}: {
  text?: string | null;
  tone?: 'error' | 'info';
}) {
  const colors = useColors();
  if (!text) return null;
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.inlineMessage,
        {
          backgroundColor: tone === 'error' ? `${colors.destructive}14` : colors.accent,
          borderColor: tone === 'error' ? `${colors.destructive}55` : colors.border,
        },
      ]}
    >
      <Text style={[styles.inlineMessageText, { color: tone === 'error' ? colors.destructive : colors.accentForeground }]}>
        {text}
      </Text>
    </View>
  );
}

export function ContentScroll({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.scrollContent, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandName: { fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
  brandEyebrow: { fontSize: 12, marginTop: 2 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 17 },
  pageTitle: { fontSize: 25, lineHeight: 31, fontWeight: '700', letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 14, lineHeight: 20, marginTop: 3 },
  surface: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 12 },
  button: { minHeight: 52, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 },
  buttonCompact: { minHeight: 42, borderRadius: 13, paddingHorizontal: 14 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  iconButton: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
  field: { gap: 7 },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  hint: { fontSize: 12, lineHeight: 17 },
  chip: { minHeight: 38, borderWidth: 1, borderRadius: 20, paddingHorizontal: 13, justifyContent: 'center' },
  chipText: { fontSize: 13, fontWeight: '600' },
  statusPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 10 },
  statusText: { fontSize: 11, fontWeight: '700' },
  emptyState: { flex: 1, minHeight: 280, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyIcon: { width: 62, height: 62, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { textAlign: 'center', fontSize: 18, fontWeight: '700' },
  emptyDescription: { textAlign: 'center', fontSize: 14, lineHeight: 21, maxWidth: 300 },
  inlineMessage: { borderWidth: 1, borderRadius: 14, padding: 12 },
  inlineMessageText: { fontSize: 13, lineHeight: 19 },
  scrollContent: { paddingBottom: 24, paddingHorizontal: 22, gap: 16 },
});