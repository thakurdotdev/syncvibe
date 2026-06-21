import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  Animated,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronRight } from 'lucide-react-native';
import { useUser } from '@/context/UserContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/button';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const { width } = Dimensions.get('window');
const CHIP_WIDTH = (width - 40 - 16) / 3;

const LANGUAGES = [
  { id: 'hindi', label: 'Hindi', native: 'हिन्दी' },
  { id: 'maithili', label: 'Maithili', native: 'मैथिली' },
  { id: 'bhojpuri', label: 'Bhojpuri', native: 'भोजपुरी' },
  { id: 'english', label: 'English', native: 'English' },
  { id: 'gujarati', label: 'Gujarati', native: 'ગુજરાતી' },
  { id: 'punjabi', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { id: 'tamil', label: 'Tamil', native: 'தமிழ்' },
  { id: 'telugu', label: 'Telugu', native: 'తెలుగు' },
  { id: 'marathi', label: 'Marathi', native: 'मराठी' },
  { id: 'bengali', label: 'Bengali', native: 'বাংলা' },
  { id: 'kannada', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { id: 'malayalam', label: 'Malayalam', native: 'മലയാളം' },
  { id: 'urdu', label: 'Urdu', native: 'اردו' },
  { id: 'haryanvi', label: 'Haryanvi', native: 'हरियाणवी' },
  { id: 'rajasthani', label: 'Rajasthani', native: 'राजस्थानी' },
  { id: 'odia', label: 'Odia', native: 'ଓଡ଼ିଆ' },
  { id: 'assamese', label: 'Assamese', native: 'অસમীয়া' },
];

interface LanguageCardProps {
  label: string;
  native: string;
  isSelected: boolean;
  onPress: () => void;
  colors: any;
}

const LanguageCard: React.FC<LanguageCardProps> = ({
  label,
  native,
  isSelected,
  onPress,
  colors,
}) => {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.94,
      useNativeDriver: true,
      tension: 150,
      friction: 6,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 150,
      friction: 6,
    }).start();
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      style={[
        styles.chip,
        {
          backgroundColor: isSelected ? colors.primary : colors.card,
          transform: [{ scale }],
        },
      ]}
    >
      <Text
        style={[
          styles.nativeLabel,
          { color: isSelected ? colors.primaryForeground : colors.foreground },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {native}
      </Text>
      <Text
        style={[
          styles.englishLabel,
          { color: isSelected ? colors.primaryForeground : colors.mutedForeground },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
};

export default function LanguagePreferenceScreen() {
  const { selectedLanguages, setSelectedLanguages } = useUser();
  const { colors } = useTheme();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();

  const [selectedLangs, setSelectedLangs] = useState<Set<string>>(
    new Set(selectedLanguages ? selectedLanguages.split(',') : ['hindi'])
  );

  const handleLanguageToggle = (lang: string) => {
    setSelectedLangs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(lang)) {
        if (newSet.size > 1) {
          newSet.delete(lang);
        }
      } else {
        newSet.add(lang);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    try {
      const langString = Array.from(selectedLangs).join(',');
      await AsyncStorage.setItem('language-preferance', langString);
      setSelectedLanguages(langString);
      toast('Preferences updated successfully!', { type: 'success' });
      router.back();
    } catch (error) {
      console.error(error);
      toast('Failed to save preferences', { type: 'error' });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Choose your music languages</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Select one or more languages to personalize your home page suggestions, daily mixes, and radio stations.
        </Text>
      </View>

      <View style={styles.gridContainer}>
        <View style={styles.grid}>
          {LANGUAGES.map((lang) => {
            const isSelected = selectedLangs.has(lang.id);
            return (
              <LanguageCard
                key={lang.id}
                label={lang.label}
                native={lang.native}
                isSelected={isSelected}
                onPress={() => handleLanguageToggle(lang.id)}
                colors={colors}
              />
            );
          })}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
        <Button
          variant="default"
          size="lg"
          onPress={handleSave}
          style={styles.saveButton}
          icon={<ChevronRight size={20} color={colors.primaryForeground} />}
          iconPosition="right"
        >
          Save Preferences
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  gridContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  chip: {
    width: CHIP_WIDTH,
    height: 66,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  nativeLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  englishLabel: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  saveButton: {
    width: '100%',
    borderRadius: 14,
    height: 52,
  },
});
