import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Conversation,
  HelperPreview,
  Message,
  MessageInput,
  Notification,
  Offer,
  OfferDecisionInput,
  Profile,
  ProfileInput,
  SwipeInput,
} from '@workspace/api-client-react';
import type { FetchInterceptor } from '@workspace/api-client-react';

const PROFILE_KEY_PREFIX = 'maid-com-demo-profile:';
const DEMO_HELPERS: HelperPreview[] = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    fullName: 'Ayesha Khan',
    city: 'Lahore',
    area: 'Gulberg',
    distanceKm: 1.8,
    skills: ['Cleaning', 'Cooking'],
    workTypes: ['Cleaning', 'Cooking', 'Laundry & ironing'],
    serviceHoursMin: 2,
    serviceHoursMax: 6,
    rateMinPkr: 800,
    rateMaxPkr: 1400,
    natureOfWork: 'Experienced with family homes and daily routines.',
    about: 'Reliable household help with 5 years of experience.',
    verificationStatus: 'verified',
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    fullName: 'Sana Malik',
    city: 'Lahore',
    area: 'Model Town',
    distanceKm: 3.4,
    skills: ['Child care', 'Cooking'],
    workTypes: ['Child care', 'Cooking', 'Elder care'],
    serviceHoursMin: 3,
    serviceHoursMax: 8,
    rateMinPkr: 1000,
    rateMaxPkr: 1800,
    natureOfWork: 'Child care and meal preparation.',
    about: 'Kind, punctual, and happy to discuss your family’s needs.',
    verificationStatus: 'pending',
  },
  {
    id: '00000000-0000-4000-8000-000000000103',
    fullName: 'Nadia Iqbal',
    city: 'Lahore',
    area: 'Johar Town',
    distanceKm: 5.2,
    skills: ['Laundry & ironing', 'Cleaning'],
    workTypes: ['Laundry & ironing', 'Cleaning', 'Kitchen help'],
    serviceHoursMin: 2,
    serviceHoursMax: 5,
    rateMinPkr: 700,
    rateMaxPkr: 1200,
    natureOfWork: 'Laundry, ironing, and kitchen support.',
    about: 'Available on weekdays; references available on request.',
    verificationStatus: 'unverified',
  },
];

interface DemoOfferRecord {
  id: string;
  clientId: string;
  helperId: string;
  clientName: string;
  amountPkr: number;
  counterAmountPkr: number | null;
  durationHours: number;
  workType: string;
  workDescription: string;
  status: Offer['status'];
  createdAt: string;
  conversationId: string | null;
}

interface DemoConversationRecord {
  id: string;
  offerId: string;
  clientId: string;
  helperId: string;
  otherName: string;
  messages: Message[];
}

let activeDemoUserId: string | null = null;
const offers: DemoOfferRecord[] = [];
const conversations: DemoConversationRecord[] = [];
const notifications: Notification[] = [];

export function setDemoApiUser(userId: string | null): void {
  activeDemoUserId = userId;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function getProfile(): Promise<Profile | null> {
  if (!activeDemoUserId) return null;
  const saved = await AsyncStorage.getItem(`${PROFILE_KEY_PREFIX}${activeDemoUserId}`);
  return saved ? (JSON.parse(saved) as Profile) : null;
}

function toOffer(record: DemoOfferRecord, profile: Profile): Offer {
  const isClient = profile.id === record.clientId;
  const helper = DEMO_HELPERS.find((item) => item.id === record.helperId);
  return {
    id: record.id,
    otherUserId: isClient ? record.helperId : record.clientId,
    otherName: isClient ? helper?.fullName ?? 'Demo helper' : record.clientName,
    myRole: isClient ? 'client' : 'helper',
    amountPkr: record.amountPkr,
    counterAmountPkr: record.counterAmountPkr,
    durationHours: record.durationHours,
    workType: record.workType,
    workDescription: record.workDescription,
    status: record.status,
    createdAt: record.createdAt,
    conversationId: record.conversationId,
  };
}

function createHelperRequest(profile: Profile): void {
  if (offers.some((offer) => offer.helperId === profile.id)) return;
  const record: DemoOfferRecord = {
    id: createId(),
    clientId: '00000000-0000-4000-8000-000000000201',
    helperId: profile.id,
    clientName: 'Demo client · Sara Ahmed',
    amountPkr: 1200,
    counterAmountPkr: null,
    durationHours: 3,
    workType: profile.skills[0] ?? 'Household help',
    workDescription: 'Looking for reliable help for a family home this week.',
    status: 'pending',
    createdAt: new Date().toISOString(),
    conversationId: null,
  };
  offers.unshift(record);
  notifications.unshift({
    id: createId(),
    kind: 'new_offer',
    title: 'You have a new work offer',
    body: `${record.clientName} sent you an offer of ₨ ${record.amountPkr}.`,
    offerId: record.id,
    conversationId: null,
    read: false,
    createdAt: record.createdAt,
  });
}

function createClientPreviewData(profile: Profile): void {
  if (offers.some((offer) => offer.clientId === profile.id)) return;
  const counterOffer: DemoOfferRecord = {
    id: createId(),
    clientId: profile.id,
    helperId: DEMO_HELPERS[1].id,
    clientName: profile.fullName,
    amountPkr: 1200,
    counterAmountPkr: 1500,
    durationHours: 3,
    workType: profile.workTypes[0] ?? 'Cleaning',
    workDescription: 'Sample counter offer from a nearby helper.',
    status: 'countered',
    createdAt: new Date().toISOString(),
    conversationId: null,
  };
  offers.unshift(counterOffer);
  notifications.unshift({
    id: createId(),
    kind: 'offer_countered',
    title: 'A helper sent a counter offer',
    body: 'Sana Malik suggested ₨ 1,500 for your visit.',
    offerId: counterOffer.id,
    conversationId: null,
    read: false,
    createdAt: counterOffer.createdAt,
  });

  const acceptedOffer: DemoOfferRecord = {
    id: createId(),
    clientId: profile.id,
    helperId: DEMO_HELPERS[0].id,
    clientName: profile.fullName,
    amountPkr: 1000,
    counterAmountPkr: null,
    durationHours: 2,
    workType: profile.workTypes[0] ?? 'Cleaning',
    workDescription: 'Sample accepted offer to preview messaging.',
    status: 'accepted',
    createdAt: new Date().toISOString(),
    conversationId: null,
  };
  const conversation: DemoConversationRecord = {
    id: createId(),
    offerId: acceptedOffer.id,
    clientId: profile.id,
    helperId: DEMO_HELPERS[0].id,
    otherName: DEMO_HELPERS[0].fullName,
    messages: [
      {
        id: createId(),
        conversationId: '',
        senderId: DEMO_HELPERS[0].id,
        text: 'Hello! I am available this week. What day works best for you?',
        voiceBase64: null,
        voiceMimeType: null,
        durationSeconds: null,
        createdAt: new Date().toISOString(),
      },
    ],
  };
  conversation.messages[0].conversationId = conversation.id;
  conversations.unshift(conversation);
  acceptedOffer.conversationId = conversation.id;
  offers.unshift(acceptedOffer);
}

function createConversation(record: DemoOfferRecord): DemoConversationRecord {
  if (record.conversationId) {
    return conversations.find((item) => item.id === record.conversationId)!;
  }
  const conversation: DemoConversationRecord = {
    id: createId(),
    offerId: record.id,
    clientId: record.clientId,
    helperId: record.helperId,
    otherName: record.clientName,
    messages: [
      {
        id: createId(),
        conversationId: '',
        senderId: record.clientId,
        text: 'Thanks for connecting! Let me know if you have any questions about the visit.',
        voiceBase64: null,
        voiceMimeType: null,
        durationSeconds: null,
        createdAt: new Date().toISOString(),
      },
    ],
  };
  conversation.messages[0].conversationId = conversation.id;
  conversations.unshift(conversation);
  record.conversationId = conversation.id;
  return conversation;
}

export const handleDemoApiRequest: FetchInterceptor = async (input, init) => {
  if (!activeDemoUserId) {
    return errorResponse('Sign in to the local demo first.', 401);
  }
  const userId = activeDemoUserId;

  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const method = (init.method ?? 'GET').toUpperCase();
  const path = url.pathname.replace(/^\/api/, '');
  const profile = await getProfile();
  const body = typeof init.body === 'string' ? JSON.parse(init.body) as unknown : null;

  if (path === '/me' && method === 'GET') {
    return jsonResponse({ profile });
  }

  if (path === '/me' && method === 'PUT') {
    const inputProfile = body as ProfileInput;
    const savedProfile: Profile = {
      ...inputProfile,
      id: userId,
      latitude: inputProfile.latitude ?? (inputProfile.role === 'client' ? 31.5204 : null),
      longitude: inputProfile.longitude ?? (inputProfile.role === 'client' ? 74.3587 : null),
      verificationStatus: 'unverified',
      createdAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(
      `${PROFILE_KEY_PREFIX}${userId}`,
      JSON.stringify(savedProfile),
    );
    if (savedProfile.role === 'helper') {
      createHelperRequest(savedProfile);
    } else {
      createClientPreviewData(savedProfile);
    }
    return jsonResponse({ profile: savedProfile });
  }

  if (path === '/me' && method === 'DELETE') {
    await AsyncStorage.removeItem(`${PROFILE_KEY_PREFIX}${userId}`);
    return jsonResponse(null, 204);
  }

  if (path === '/helpers' && method === 'GET') {
    if (profile?.role !== 'client') {
      return errorResponse('Only client demo accounts can discover helpers.', 403);
    }
    return jsonResponse(DEMO_HELPERS);
  }

  if (path === '/swipes' && method === 'POST') {
    if (profile?.role !== 'client') {
      return errorResponse('Complete a client profile before sending offers.', 403);
    }
    const swipe = body as SwipeInput;
    const helper = DEMO_HELPERS.find((item) => item.id === swipe.helperId);
    if (!helper) return errorResponse('Demo helper was not found.', 404);
    if (swipe.direction === 'left') return jsonResponse({ recorded: true, offerId: null, helperNotified: false }, 201);

    const record: DemoOfferRecord = {
      id: createId(),
      clientId: profile.id,
      helperId: helper.id,
      clientName: profile.fullName,
      amountPkr: swipe.offerAmountPkr ?? 0,
      counterAmountPkr: null,
      durationHours: swipe.durationHours,
      workType: swipe.workType,
      workDescription: swipe.workDescription,
      status: 'pending',
      createdAt: new Date().toISOString(),
      conversationId: null,
    };
    offers.unshift(record);
    notifications.unshift({
      id: createId(),
      kind: 'offer_sent',
      title: 'Offer sent',
      body: `Your offer for ${helper.fullName} is on its way.`,
      offerId: record.id,
      conversationId: null,
      read: false,
      createdAt: record.createdAt,
    });
    return jsonResponse({ recorded: true, offerId: record.id, helperNotified: true }, 201);
  }

  if (path === '/offers' && method === 'GET') {
    if (!profile) return jsonResponse([]);
    return jsonResponse(
      offers
        .filter((item) => item.clientId === profile.id || item.helperId === profile.id)
        .map((item) => toOffer(item, profile)),
    );
  }

  const offerMatch = path.match(/^\/offers\/([^/]+)$/);
  if (offerMatch && method === 'PATCH') {
    if (!profile) return errorResponse('Complete a profile to respond to offers.', 403);
    const record = offers.find((item) => item.id === offerMatch[1]);
    if (!record || (record.clientId !== profile.id && record.helperId !== profile.id)) {
      return errorResponse('Offer not found.', 404);
    }
    const decision = body as OfferDecisionInput;
    if (decision.action === 'decline') {
      record.status = 'declined';
    } else if (decision.action === 'counter') {
      record.status = 'countered';
      record.counterAmountPkr = decision.counterAmountPkr ?? null;
    } else {
      record.status = 'accepted';
      const conversation = createConversation(record);
      notifications.unshift({
        id: createId(),
        kind: 'offer_accepted',
        title: 'Offer accepted',
        body: `${profile.fullName} accepted the offer. Your conversation is ready.`,
        offerId: record.id,
        conversationId: conversation.id,
        read: false,
        createdAt: new Date().toISOString(),
      });
    }
    return jsonResponse({
      offer: toOffer(record, profile),
      conversationId: record.conversationId,
    });
  }

  if (path === '/notifications' && method === 'GET') {
    return jsonResponse(notifications);
  }

  const notificationMatch = path.match(/^\/notifications\/([^/]+)\/read$/);
  if (notificationMatch && method === 'PATCH') {
    const notification = notifications.find((item) => item.id === notificationMatch[1]);
    if (!notification) return errorResponse('Notification not found.', 404);
    notification.read = true;
    return jsonResponse(null, 204);
  }

  if (path === '/conversations' && method === 'GET') {
    const ownConversations = conversations.filter(
      (item) => item.clientId === userId || item.helperId === userId,
    );
    const result: Conversation[] = ownConversations.map((item) => {
      const lastMessage = item.messages[item.messages.length - 1];
      return {
        id: item.id,
        otherUserId: item.clientId === userId ? item.helperId : item.clientId,
        otherName: item.clientId === userId
          ? DEMO_HELPERS.find((helper) => helper.id === item.helperId)?.fullName ?? 'Demo helper'
          : item.otherName,
        lastMessage: lastMessage?.text ?? 'Voice message',
        lastMessageAt: lastMessage?.createdAt ?? null,
        unreadCount: 0,
      };
    });
    return jsonResponse(result);
  }

  const messagesMatch = path.match(/^\/conversations\/([^/]+)\/messages$/);
  if (messagesMatch) {
    const conversation = conversations.find((item) => item.id === messagesMatch[1]);
    if (!conversation || (conversation.clientId !== userId && conversation.helperId !== userId)) {
      return errorResponse('Conversation not found.', 404);
    }
    if (method === 'GET') return jsonResponse(conversation.messages);
    if (method === 'POST') {
      const message = body as MessageInput;
      const savedMessage: Message = {
        id: createId(),
        conversationId: conversation.id,
        senderId: userId,
        text: message.text,
        voiceBase64: message.voiceBase64,
        voiceMimeType: message.voiceMimeType,
        durationSeconds: message.durationSeconds,
        createdAt: new Date().toISOString(),
      };
      conversation.messages.push(savedMessage);
      return jsonResponse(savedMessage, 201);
    }
  }

  return errorResponse(`No local demo handler for ${method} ${path}.`, 404);
};
