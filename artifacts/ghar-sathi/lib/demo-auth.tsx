import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setDemoApiUser } from './demo-api';

const USERS_KEY = 'maid-com-demo-users';
const SESSION_KEY = 'maid-com-demo-session';

export interface DemoUser {
  id: string;
  email: string;
  fullName: string;
}

interface DemoAuthValue {
  isLoaded: boolean;
  user: DemoUser | null;
  signUp: (fullName: string, email: string) => Promise<void>;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const DemoAuthContext = createContext<DemoAuthValue | null>(null);

function createDemoUserId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `demo-user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function readUsers(): Promise<DemoUser[]> {
  const saved = await AsyncStorage.getItem(USERS_KEY);
  return saved ? (JSON.parse(saved) as DemoUser[]) : [];
}

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<DemoUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(SESSION_KEY)
      .then((saved) => {
        if (!active) return;
        const restoredUser = saved ? (JSON.parse(saved) as DemoUser) : null;
        setDemoApiUser(restoredUser?.id ?? null);
        setUser(restoredUser);
      })
      .catch((error: unknown) => {
        console.error('Could not restore the local demo session.', error);
      })
      .finally(() => {
        if (active) setIsLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const activate = async (nextUser: DemoUser) => {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(nextUser));
    setDemoApiUser(nextUser.id);
    setUser(nextUser);
    queryClient.clear();
  };

  const signUp = async (fullName: string, email: string) => {
    const users = await readUsers();
    if (users.some((item) => item.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('That email already has a local demo account. Sign in instead.');
    }
    const newUser: DemoUser = {
      id: createDemoUserId(),
      email: email.trim().toLowerCase(),
      fullName: fullName.trim(),
    };
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify([...users, newUser]));
    await activate(newUser);
  };

  const signIn = async (email: string) => {
    const users = await readUsers();
    const existing = users.find(
      (item) => item.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (!existing) {
      throw new Error('No local demo account found for that email. Create one first.');
    }
    await activate(existing);
  };

  const signOut = async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    setDemoApiUser(null);
    setUser(null);
    queryClient.clear();
  };

  const value = useMemo(
    () => ({ isLoaded, user, signUp, signIn, signOut }),
    [isLoaded, user],
  );

  return <DemoAuthContext.Provider value={value}>{children}</DemoAuthContext.Provider>;
}

export function useDemoAuth(): DemoAuthValue {
  const context = useContext(DemoAuthContext);
  if (!context) {
    throw new Error('useDemoAuth must be used inside DemoAuthProvider.');
  }
  return context;
}
