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
} from 'react';
import { Appearance, AppState, useColorScheme } from 'react-native';

const THEME_PREFERENCE_KEY = '@theme_preference';

type ThemePreference = ColorTheme | 'system';

const isColorTheme = (value: string | null | undefined): value is ColorTheme =>
  value === 'light' || value === 'dark';

const parseThemePreference = (value: string | null): ThemePreference =>
  value === 'system' || isColorTheme(value) ? value : 'system';

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
  const [theme, setThemeState] = useState<ColorTheme>(
    isColorTheme(deviceColorScheme) ? deviceColorScheme : 'light'
  );
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const prevThemeRef = useRef<ThemePreference>(themePreference);
  const pendingThemeUpdate = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        setThemeState(isColorTheme(deviceColorScheme) ? deviceColorScheme : 'light');
      } else {
        setThemeState(newTheme as ColorTheme);
      }

      // Keep the visible theme update synchronous. A transition here makes
      // the profile toggle feel unresponsive while the whole app repaints.
      setThemePreference(newTheme);
      pendingThemeUpdate.current = setTimeout(() => {
        storageCache.setItem(THEME_PREFERENCE_KEY, newTheme).catch((error) => {
          console.log('Error saving theme preference:', error);
        });
      }, 300);
    },
    [deviceColorScheme]
  );

  useEffect(() => {
    let isMounted = true;

    const loadPreferences = async () => {
      try {
        const savedTheme = await storageCache.getItem(THEME_PREFERENCE_KEY);

        if (!isMounted) return;

        const preference = parseThemePreference(savedTheme);
        const systemTheme = Appearance.getColorScheme();
        const effectiveTheme =
          preference === 'system'
            ? isColorTheme(systemTheme)
              ? systemTheme
              : 'light'
            : preference;

        // Keep the ref in sync with the persisted preference. Without this,
        // setSystemTheme() can be ignored after loading a saved light/dark value.
        prevThemeRef.current = preference;
        setThemePreference(preference);
        setThemeState(effectiveTheme);
      } catch (error) {
        console.log('Error loading preferences:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && themePreference === 'system') {
        const currentColorScheme = Appearance.getColorScheme();
        if (isColorTheme(currentColorScheme) && currentColorScheme !== theme) {
          setThemeState(currentColorScheme);
        }
      }
    });

    return () => subscription.remove();
  }, [theme, themePreference]);

  useEffect(() => {
    if (deviceColorScheme && themePreference === 'system') {
      setThemeState(deviceColorScheme);
    }
  }, [deviceColorScheme, themePreference]);

  useEffect(() => {
    return () => {
      if (pendingThemeUpdate.current) {
        clearTimeout(pendingThemeUpdate.current);
      }
    };
  }, []);

  const setTheme = useCallback((newTheme: ThemePreference) => updateTheme(newTheme), [updateTheme]);

  const toggleTheme = useCallback(() => {
    updateTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, updateTheme]);

  const setSystemTheme = useCallback(() => updateTheme('system'), [updateTheme]);

  const themeColors = useMemo(() => colorPalettes.default[theme], [theme]);

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
    [theme, themeColors, isLoading, toggleTheme, setTheme, setSystemTheme, themePreference]
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
