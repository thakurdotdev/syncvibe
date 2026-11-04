import { BeatHero } from '@/components/onboarding/BeatHero';
import { LanguageStep } from '@/components/onboarding/LanguageStep';
import { SignInStep } from '@/components/onboarding/SignInStep';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { LANGUAGE_STORAGE_KEY } from '@/lib/languages';
import { ONBOARDING_STORAGE_KEY } from '@/lib/onboarding';
import { typography } from '@/theme/typography';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { ReactNode, useCallback, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

const PAGE_COUNT = 3;
const LAST_PAGE = PAGE_COUNT - 1;

interface PageProps {
  index: number;
  scrollX: SharedValue<number>;
  width: number;
  children: ReactNode;
  footer?: ReactNode;
}

/** A full-width page whose content drifts and fades against the swipe. */
function Page({ index, scrollX, width, children, footer }: PageProps) {
  const contentStyle = useAnimatedStyle(() => {
    const range = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
      transform: [
        {
          translateX: interpolate(
            scrollX.value,
            range,
            [width * 0.25, 0, -width * 0.25],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  return (
    <View style={{ width }}>
      <Animated.View style={[styles.pageContent, contentStyle]}>{children}</Animated.View>
      {footer ? <View style={styles.pageFooter}>{footer}</View> : null}
    </View>
  );
}

function ProgressSegment({
  index,
  scrollX,
  width,
}: Pick<PageProps, 'index' | 'scrollX' | 'width'>) {
  const { colors } = useTheme();

  const fillStyle = useAnimatedStyle(() => ({
    width: `${interpolate(
      scrollX.value,
      [(index - 1) * width, index * width],
      [0, 100],
      Extrapolation.CLAMP
    )}%`,
  }));

  return (
    <View style={[styles.segment, { backgroundColor: colors.raised }]}>
      <Animated.View style={[styles.segmentFill, { backgroundColor: colors.primary }, fillStyle]} />
    </View>
  );
}

export default function OnboardingScreen() {
  const { user, selectedLanguages, setSelectedLanguages } = useUser();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const pagerRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const pageIndex = useSharedValue(0);
  const finished = useRef(false);
  const [page, setPage] = useState(0);
  const [languages, setLanguages] = useState(
    () => new Set(selectedLanguages.split(',').filter(Boolean))
  );

  const handlePageChange = (next: number) => {
    setPage(next);
    Haptics.selectionAsync().catch(() => {});
  };

  // Works out the page from the scroll position, so swipes and button presses both update it.
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
    const next = Math.round(event.contentOffset.x / width);
    if (next !== pageIndex.value) {
      pageIndex.value = next;
      scheduleOnRN(handlePageChange, next);
    }
  });

  const goTo = (index: number) => {
    pagerRef.current?.scrollTo({ x: index * width, animated: true });
  };

  const finish = useCallback(async () => {
    if (finished.current) return;
    finished.current = true;

    const languageList = Array.from(languages).join(',');
    setSelectedLanguages(languageList);
    try {
      await AsyncStorage.multiSet([
        [LANGUAGE_STORAGE_KEY, languageList],
        [ONBOARDING_STORAGE_KEY, '1'],
      ]);
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
    router.replace('/(tabs)/home');
  }, [languages, router, setSelectedLanguages]);

  // Runs only while this screen is focused: a login on the modal above closes itself first, and
  // onboarding then finishes when focus returns here.
  useFocusEffect(
    useCallback(() => {
      if (user) finish();
    }, [user, finish])
  );

  // Registered only while focused, so the back button still closes the login modal.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (page === 0) return false;
        pagerRef.current?.scrollTo({ x: (page - 1) * width, animated: true });
        return true;
      });
      return () => subscription.remove();
    }, [page, pagerRef, width])
  );

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 12,
          paddingBottom: Math.max(insets.bottom + 12, 20),
        },
      ]}
    >
      <View style={styles.topBar}>
        <View style={styles.segments}>
          {Array.from({ length: PAGE_COUNT }, (_, index) => (
            <ProgressSegment key={index} index={index} scrollX={scrollX} width={width} />
          ))}
        </View>
        <Pressable
          onPress={() => goTo(LAST_PAGE)}
          disabled={page === LAST_PAGE}
          hitSlop={12}
          accessibilityRole='button'
          accessibilityElementsHidden={page === LAST_PAGE}
          importantForAccessibility={page === LAST_PAGE ? 'no-hide-descendants' : 'auto'}
          style={[styles.skip, page === LAST_PAGE && styles.hidden]}
        >
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
        </Pressable>
      </View>

      <Animated.ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        bounces={false}
        overScrollMode='never'
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps='handled'
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        <Page
          index={0}
          scrollX={scrollX}
          width={width}
          footer={
            <Button
              size='lg'
              onPress={() => goTo(1)}
              icon={<ArrowRight size={20} color={colors.primaryForeground} />}
              iconPosition='right'
              style={styles.fullWidth}
            >
              Get started
            </Button>
          }
        >
          <View style={styles.welcome}>
            <BeatHero active={page === 0} />
            <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>
              Music is better in sync
            </Text>
            <Text style={[styles.welcomeBody, { color: colors.mutedForeground }]}>
              Start a room and hear every beat at the same moment as your friends, wherever they
              are.
            </Text>
          </View>
        </Page>

        <Page
          index={1}
          scrollX={scrollX}
          width={width}
          footer={
            <Button
              size='lg'
              onPress={() => goTo(2)}
              icon={<ArrowRight size={20} color={colors.primaryForeground} />}
              iconPosition='right'
              style={styles.fullWidth}
            >
              Continue
            </Button>
          }
        >
          <LanguageStep selected={languages} onChange={setLanguages} />
        </Page>

        <Page index={2} scrollX={scrollX} width={width}>
          <SignInStep active={page === LAST_PAGE} languages={languages} onSkip={finish} />
        </Page>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
    height: 32,
    marginBottom: 12,
  },
  segments: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  segmentFill: {
    height: '100%',
    borderRadius: 2,
  },
  skip: {
    minWidth: 32,
    alignItems: 'flex-end',
  },
  hidden: {
    opacity: 0,
  },
  skipText: {
    ...typography.labelLg,
  },
  pager: {
    flex: 1,
  },
  pageContent: {
    flex: 1,
  },
  pageFooter: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  fullWidth: {
    width: '100%',
  },
  welcome: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  welcomeTitle: {
    ...typography.displayXl,
    textAlign: 'center',
    marginTop: 28,
  },
  welcomeBody: {
    ...typography.bodyLg,
    textAlign: 'center',
    marginTop: 12,
  },
});
