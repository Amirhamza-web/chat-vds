import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'glass';

export const THEMES: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'Светлая', icon: '☀' },
  { value: 'dark', label: 'Тёмная', icon: '☾' },
  { value: 'glass', label: 'Neo-glass', icon: '✦' },
];

interface ThemeStore {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

function applyTheme(theme: Theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme;
  }
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
    }),
    {
      name: 'chat-vds-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);

/** Call once at app boot to ensure data-theme matches the persisted store. */
export function initTheme() {
  applyTheme(useThemeStore.getState().theme);
}
