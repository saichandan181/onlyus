import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api, User, Partner, PairStatus } from '@/services/api';
import { generateKeyPair } from '@/services/encryption';
import { usePairLocalStore } from '@/stores/pairLocalStore';
import { useChatStore } from '@/stores/chatStore';

interface AuthState {
  user: User | null;
  token: string | null;
  partner: Partner | null;
  pairStatus: PairStatus | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPaired: boolean;
  sharedSecret: string | null;

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshPairStatus: () => Promise<void>;
  setPartner: (partner: Partner | null) => void;
  setPartnerOnline: (online: boolean) => void;
  setSharedSecret: (secret: string) => void;
  updateUser: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  partner: null,
  pairStatus: null,
  isLoading: true,
  isAuthenticated: false,
  isPaired: false,
  sharedSecret: null,

  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (!token) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      set({ token });
      const user = await api.getMe();
      set({ user, isAuthenticated: true });

      // Register for push notifications
      try {
        const { registerForPushNotificationsAsync } = await import('@/services/notifications');
        const pushToken = await registerForPushNotificationsAsync();
        if (pushToken) {
          await api.updatePushToken(pushToken);
        }
      } catch (err) {
        console.log('Push notification registration failed:', err);
      }

      // Check pairing
      try {
        const pairStatus = await api.getPairStatus();
        set({
          pairStatus,
          isPaired: pairStatus.paired,
          partner: pairStatus.partner,
        });
        useChatStore.getState().setPartnerOnline(pairStatus.partner?.is_online ?? false);
      } catch {
        // Not paired
      }

      const u = get().user;
      if (u?.public_key && get().partner?.public_key) {
        const { derivePairSharedSecret } = await import('@/services/encryption');
        const secret = await derivePairSharedSecret(u.public_key, get().partner!.public_key!);
        set({ sharedSecret: secret });
      }
      await usePairLocalStore.getState().hydrate();
    } catch {
      // Token invalid
      await SecureStore.deleteItemAsync('auth_token');
      set({ isAuthenticated: false, token: null });
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    const response = await api.login(email, password);
    await SecureStore.setItemAsync('auth_token', response.token);
    set({
      user: response.user,
      token: response.token,
      isAuthenticated: true,
    });

    // Check pairing
    try {
      const pairStatus = await api.getPairStatus();
      set({
        pairStatus,
        isPaired: pairStatus.paired,
        partner: pairStatus.partner,
      });
      useChatStore.getState().setPartnerOnline(pairStatus.partner?.is_online ?? false);
      const u = get().user;
      if (u?.public_key && pairStatus.partner?.public_key) {
        const { derivePairSharedSecret } = await import('@/services/encryption');
        const secret = await derivePairSharedSecret(u.public_key, pairStatus.partner.public_key);
        set({ sharedSecret: secret });
      }
      await usePairLocalStore.getState().hydrate();
    } catch {}
  },

  register: async (name: string, email: string, password: string) => {
    // Generate encryption keypair
    const { publicKey, privateKey } = await generateKeyPair();
    await SecureStore.setItemAsync('private_key', privateKey);

    const response = await api.register(name, email, password, publicKey);
    await SecureStore.setItemAsync('auth_token', response.token);
    set({
      user: response.user,
      token: response.token,
      isAuthenticated: true,
    });
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {}
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('private_key');
    await usePairLocalStore.getState().clear();
    useChatStore.getState().setPartnerOnline(false);
    set({
      user: null,
      token: null,
      partner: null,
      pairStatus: null,
      isAuthenticated: false,
      isPaired: false,
      sharedSecret: null,
    });
  },

  refreshUser: async () => {
    try {
      const user = await api.getMe();
      set({ user });
    } catch {}
  },

  refreshPairStatus: async () => {
    try {
      const pairStatus = await api.getPairStatus();
      set({
        pairStatus,
        isPaired: pairStatus.paired,
        partner: pairStatus.partner,
      });
      useChatStore.getState().setPartnerOnline(pairStatus.partner?.is_online ?? false);
      const u = get().user;
      if (u?.public_key && get().partner?.public_key) {
        const { derivePairSharedSecret } = await import('@/services/encryption');
        const secret = await derivePairSharedSecret(u.public_key, get().partner!.public_key!);
        set({ sharedSecret: secret });
      }
      await usePairLocalStore.getState().hydrate();
    } catch {}
  },

  setPartner: (partner: Partner | null) => set({ partner, isPaired: !!partner }),
  setPartnerOnline: (online: boolean) => {
    const partner = get().partner;
    if (partner) {
      set({ partner: { ...partner, is_online: online } });
    }
  },
  setSharedSecret: (secret: string) => set({ sharedSecret: secret }),
  updateUser: (data: Partial<User>) => {
    const user = get().user;
    if (user) {
      set({ user: { ...user, ...data } });
    }
  },
}));
