import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ThemePaletteId } from '@/constants/theme';

export type AppearanceMode = 'system' | 'light' | 'dark';

interface ThemeSettingsState {
  appearance: AppearanceMode;
  paletteId: ThemePaletteId;
  setAppearance: (mode: AppearanceMode) => void;
  setPaletteId: (id: ThemePaletteId) => void;
}

export const useThemeSettingsStore = create<ThemeSettingsState>()(
  persist(
    (set) => ({
      appearance: 'system',
      paletteId: 'onlyus',
      setAppearance: (appearance) => set({ appearance }),
      setPaletteId: (paletteId) => set({ paletteId }),
    }),
    {
      name: 'onlyus-theme-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
