import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Language = 'en' | 'ur' | 'romanUrdu';

const copy: Record<Language, Record<string, string>> = {
  en: {
    brand: 'Ghar Sathi',
    tagline: 'Good help. Right at home.',
    discover: 'Discover',
    requests: 'Requests',
    chats: 'Chats',
    alerts: 'Alerts',
    profile: 'Profile',
    signIn: 'Sign in',
    signUp: 'Create account',
    email: 'Email address',
    password: 'Password',
    fullName: 'Full name',
    city: 'City',
    area: 'Area or neighbourhood',
    language: 'Language',
    client: 'I need household help',
    helper: 'I offer household services',
    next: 'Continue',
    saveProfile: 'Save my profile',
    useLocation: 'Use my current location',
    discoverIntro: 'Find trusted help nearby',
    noHelpers: 'No helpers nearby yet',
    offerAmount: 'Your total offer (PKR)',
    duration: 'Hours for this visit',
    pass: 'Pass',
    sendOffer: 'Offer & like',
    verified: 'Verified',
    pending: 'Pending verification',
    unverified: 'Not verified',
    noRequests: 'No requests yet',
    noChats: 'Your conversations will appear here',
    noAlerts: 'You are all caught up',
    signOut: 'Sign out',
    deleteAccount: 'Delete account',
    deleteConfirm: 'This permanently deletes your marketplace profile and data.',
    send: 'Send',
    typeMessage: 'Write a message…',
    recordVoice: 'Record a voice message',
    retry: 'Try again',
    databaseUnavailable: 'The marketplace database is not connected yet.',
  },
  ur: {
    brand: 'گھر ساتھی',
    tagline: 'گھر کے کام کے لیے قابلِ اعتماد مدد',
    discover: 'تلاش',
    requests: 'درخواستیں',
    chats: 'چیٹ',
    alerts: 'اطلاعات',
    profile: 'پروفائل',
    signIn: 'لاگ اِن',
    signUp: 'اکاؤنٹ بنائیں',
    email: 'ای میل ایڈریس',
    password: 'پاس ورڈ',
    fullName: 'پورا نام',
    city: 'شہر',
    area: 'علاقہ یا محلہ',
    language: 'زبان',
    client: 'مجھے گھر کے کام میں مدد چاہیے',
    helper: 'میں گھر کی خدمات فراہم کرتا/کرتی ہوں',
    next: 'جاری رکھیں',
    saveProfile: 'پروفائل محفوظ کریں',
    useLocation: 'میری موجودہ جگہ استعمال کریں',
    discoverIntro: 'قریبی مدد تلاش کریں',
    noHelpers: 'قریب میں ابھی کوئی مددگار نہیں',
    offerAmount: 'آپ کی کل پیشکش (روپے)',
    duration: 'اس کام کے گھنٹے',
    pass: 'آگے بڑھیں',
    sendOffer: 'پیشکش بھیجیں',
    verified: 'تصدیق شدہ',
    pending: 'تصدیق جاری ہے',
    unverified: 'تصدیق نہیں ہوئی',
    noRequests: 'ابھی کوئی درخواست نہیں',
    noChats: 'آپ کی گفتگو یہاں نظر آئے گی',
    noAlerts: 'تمام اطلاعات دیکھی جا چکی ہیں',
    signOut: 'لاگ آؤٹ',
    deleteAccount: 'اکاؤنٹ حذف کریں',
    deleteConfirm: 'اس سے آپ کا پروفائل اور ڈیٹا مستقل طور پر حذف ہو جائے گا۔',
    send: 'بھیجیں',
    typeMessage: 'پیغام لکھیں…',
    recordVoice: 'آواز کا پیغام ریکارڈ کریں',
    retry: 'دوبارہ کوشش کریں',
    databaseUnavailable: 'مارکیٹ پلیس کا ڈیٹا بیس ابھی منسلک نہیں ہے۔',
  },
  romanUrdu: {
    brand: 'Ghar Sathi',
    tagline: 'Ghar ke kaam ke liye bharosemand madad',
    discover: 'Dhoondein',
    requests: 'Darkhwastein',
    chats: 'Guftagu',
    alerts: 'Ittilaat',
    profile: 'Profile',
    signIn: 'Sign in',
    signUp: 'Account banayein',
    email: 'Email address',
    password: 'Password',
    fullName: 'Poora naam',
    city: 'Shehar',
    area: 'Ilaqa ya mohallah',
    language: 'Zabaan',
    client: 'Mujhe ghar ke kaam mein madad chahiye',
    helper: 'Main ghar ki khidmaat deta/deti hoon',
    next: 'Jari rakhein',
    saveProfile: 'Profile mehfooz karein',
    useLocation: 'Meri mojooda location istemal karein',
    discoverIntro: 'Qareeb bharosemand madad dhoondein',
    noHelpers: 'Qareeb abhi koi helper nahi',
    offerAmount: 'Aap ki kul peshkash (PKR)',
    duration: 'Is kaam ke ghante',
    pass: 'Aage barhein',
    sendOffer: 'Peshkash bhejein',
    verified: 'Tasdeeq shuda',
    pending: 'Tasdeeq jari hai',
    unverified: 'Tasdeeq nahi hui',
    noRequests: 'Abhi koi darkhwast nahi',
    noChats: 'Aap ki guftagu yahan nazar aaye gi',
    noAlerts: 'Aap ne sab ittilaat dekh li hain',
    signOut: 'Sign out',
    deleteAccount: 'Account khatam karein',
    deleteConfirm: 'Is se aap ka profile aur data mustaqil khatam ho jayega.',
    send: 'Bhejein',
    typeMessage: 'Paigham likhein…',
    recordVoice: 'Voice message record karein',
    retry: 'Dobara koshish karein',
    databaseUnavailable: 'Marketplace database abhi connect nahi hai.',
  },
};

interface LanguageContextValue {
  language: Language;
  isRTL: boolean;
  t: (key: string) => string;
  setLanguage: (language: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    AsyncStorage.getItem('ghar-sathi-language')
      .then((value) => {
        if (value === 'en' || value === 'ur' || value === 'romanUrdu') {
          setLanguageState(value);
        }
      })
      .catch(() => undefined);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      isRTL: language === 'ur',
      t: (key) => copy[language][key] ?? copy.en[key] ?? key,
      setLanguage: (next) => {
        setLanguageState(next);
        AsyncStorage.setItem('ghar-sathi-language', next).catch(() => undefined);
      },
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}