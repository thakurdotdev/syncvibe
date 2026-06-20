import { colorPalettes, ColorTheme, ThemeColors } from '@/theme/color';
import { storageCache } from '@/utils/storageCache';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { Appearance, AppState, InteractionManager, useColorScheme } from 'react-native';

const THEME_PREFERENCE_KEY = '@theme_preference';

type ThemePreference = ColorTheme | 'system';

interface ThemeContextType {
  theme: ColorTheme;
  colors: ThemeColors;
  isLoading: boolean;
  toggleTheme: () => void;
  setTheme: (theme: ThemePreference) => void;
  setSystemTheme: () => void;
  themePreference: ThemePreference;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const deviceColorScheme = useColorScheme() as ColorTheme | null;
  const [theme, setThemeState] = useState<ColorTheme>(deviceColorScheme || 'light');
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  const prevThemeRef = useRef<ThemePreference>(themePreference);
  const pendingThemeUpdate = useRef<NodeJS.Timeout | null>(null);

  const updateTheme = useCallback(
    (newTheme: ThemePreference) => {
      if (newTheme === prevThemeRef.current) {
        return;
      }

      prevThemeRef.current = newTheme;

      if (pendingThemeUpdate.current) {
        clearTimeout(pendingThemeUpdate.current);
      }

      if (newTheme === 'system') {
        setThemeState(deviceColorScheme || 'light');
      } else {
        setThemeState(newTheme as ColorTheme);
      }

      startTransition(() => {
        setThemePreference(newTheme);
        pendingThemeUpdate.current = setTimeout(() => {
          InteractionManager.runAfterInteractions(() => {
            storageCache.setItem(THEME_PREFERENCE_KEY, newTheme).catch((error) => {
              console.log('Error saving theme preference:', error);
            });
          });
        }, 300);
      });
    },
    [deviceColorScheme, startTransition]
  );

  useEffect(() => {
    let isMounted = true;

    const loadPreferences = async () => {
      try {
        const savedTheme = await storageCache.getItem(THEME_PREFERENCE_KEY);

        if (!isMounted) return;

        if (savedTheme !== null) {
          setThemePreference(savedTheme as ThemePreference);
          if (savedTheme === 'system') {
            setThemeState(deviceColorScheme || 'light');
          } else {
            setThemeState(savedTheme as ColorTheme);
          }
        } else {
          setThemePreference('system');
          setThemeState(deviceColorScheme || 'light');
        }
      } catch (error) {
        console.log('Error loading preferences:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadPreferences();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && themePreference === 'system') {
        const currentColorScheme = Appearance.getColorScheme() as ColorTheme | null;
        if (currentColorScheme && currentColorScheme !== theme) {
          setThemeState(currentColorScheme);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (deviceColorScheme && themePreference === 'system') {
      setThemeState(deviceColorScheme);
    }
  }, [deviceColorScheme, themePreference]);

  const setTheme = (newTheme: ThemePreference) => {
    updateTheme(newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    updateTheme(newTheme);
  };

  const setSystemTheme = () => {
    updateTheme('system');
  };

  const themeColors = useMemo(() => colorPalettes['default'][theme], [theme]);

  const contextValue = useMemo(
    () => ({
      theme,
      colors: themeColors,
      isLoading,
      toggleTheme,
      setTheme,
      setSystemTheme,
      themePreference,
    }),
    [theme, themeColors, isLoading, toggleTheme, themePreference]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
