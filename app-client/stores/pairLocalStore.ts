import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const KEY_ANNIVERSARY = 'onlyus_local_anniversary_iso';
const KEY_MY_MOOD = 'onlyus_local_my_mood';

/**
 * Anniversary + my mood: device-only persistence (SecureStore).
 * Partner receives updates via socket relay only; server DB does not store these.
 */
interface PairLocalState {
  anniversaryIso: string | null;
  myMoodKey: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setAnniversaryIso: (iso: string | null) => Promise<void>;
  setMyMoodKey: (moodKey: string | null) => Promise<void>;
  clear: () => Promise<void>;
}

export const usePairLocalStore = create<PairLocalState>((set, get) => ({
  anniversaryIso: null,
  myMoodKey: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const [a, m] = await Promise.all([
        SecureStore.getItemAsync(KEY_ANNIVERSARY),
        SecureStore.getItemAsync(KEY_MY_MOOD),
      ]);
      set({
        anniversaryIso: a,
        myMoodKey: m,
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },

  setAnniversaryIso: async (iso) => {
    if (iso) {
      await SecureStore.setItemAsync(KEY_ANNIVERSARY, iso);
    } else {
      await SecureStore.deleteItemAsync(KEY_ANNIVERSARY);
    }
    set({ anniversaryIso: iso });
  },

  setMyMoodKey: async (moodKey) => {
    if (moodKey) {
      await SecureStore.setItemAsync(KEY_MY_MOOD, moodKey);
    } else {
      await SecureStore.deleteItemAsync(KEY_MY_MOOD);
    }
    set({ myMoodKey: moodKey });
  },

  clear: async () => {
    try {
      await SecureStore.deleteItemAsync(KEY_ANNIVERSARY);
      await SecureStore.deleteItemAsync(KEY_MY_MOOD);
    } catch {
      /* ignore */
    }
    set({ anniversaryIso: null, myMoodKey: null, hydrated: true });
  },
}));
