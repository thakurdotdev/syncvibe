import { AuthPanel } from '@/components/auth/AuthPanel';
import { BeatHero } from '@/components/onboarding/BeatHero';
import { LanguageStep } from '@/components/onboarding/LanguageStep';
import { HeaderIconButton } from '@/components/ui/AppHeader';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { LANGUAGE_STORAGE_KEY } from '@/lib/languages';
import { typography } from '@/theme/typography';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { ArrowRight } from '@/components/ui/icons';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import PressableScale from '@/components/ui/PressableScale';
import { BUTTON_PRESS_SCALE } from '@/lib/motion';
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
      opacity: interpolate(scrollX.get(), range, [0, 1, 0], Extrapolation.CLAMP),
      transform: [
        {
          translateX: interpolate(
            scrollX.get(),
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
      scrollX.get(),
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
  const { selectedLanguages, setSelectedLanguages } = useUser();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const pagerRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const pageIndex = useSharedValue(0);
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [languages, setLanguages] = useState(
    () => new Set(selectedLanguages.split(',').filter(Boolean))
  );

  // Saved on reaching sign-in, so they're kept however the account gets signed in. Onboarding
  // itself is marked done by the auth gate once a profile loads.
  const onSignInPage = page === LAST_PAGE;
  useEffect(() => {
    if (!onSignInPage) return;
    const languageList = Array.from(languages).join(',');
    setSelectedLanguages(languageList);
    AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, languageList).catch((error) =>
      console.error('Failed to save languages:', error)
    );
  }, [onSignInPage, languages, setSelectedLanguages]);

  const handlePageChange = (next: number) => {
    setPage(next);
  };

  // Works out the page from the scroll position, so swipes and button presses both update it.
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.set(event.contentOffset.x);
    const next = Math.round(event.contentOffset.x / width);
    if (next !== pageIndex.get()) {
      pageIndex.set(next);
      scheduleOnRN(handlePageChange, next);
    }
  });

  const goTo = (index: number) => {
    pagerRef.current?.scrollTo({ x: index * width, animated: true });
  };

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        // An open email step handles back itself.
        if (page === 0 || formOpen) return false;
        pagerRef.current?.scrollTo({ x: (page - 1) * width, animated: true });
        return true;
      });
      return () => subscription.remove();
    }, [page, formOpen, pagerRef, width])
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
      {/* An open email step has its own back button, so the bar steps aside. */}
      <View
        style={[styles.topBar, formOpen && styles.hidden]}
        pointerEvents={formOpen ? 'none' : 'auto'}
        importantForAccessibility={formOpen ? 'no-hide-descendants' : 'auto'}
      >
        <View
          style={page === 0 && styles.hidden}
          pointerEvents={page === 0 ? 'none' : 'auto'}
          importantForAccessibility={page === 0 ? 'no-hide-descendants' : 'auto'}
        >
          <HeaderIconButton
            icon='chevron-back'
            label='Previous step'
            onPress={() => goTo(Math.max(0, page - 1))}
          />
        </View>
        <View style={styles.segments}>
          {Array.from({ length: PAGE_COUNT }, (_, index) => (
            <ProgressSegment key={index} index={index} scrollX={scrollX} width={width} />
          ))}
        </View>
        <PressableScale
          onPress={() => goTo(LAST_PAGE)}
          scaleTo={BUTTON_PRESS_SCALE}
          disabled={page === LAST_PAGE}
          hitSlop={12}
          accessibilityRole='button'
          accessibilityElementsHidden={page === LAST_PAGE}
          importantForAccessibility={page === LAST_PAGE ? 'no-hide-descendants' : 'auto'}
          style={[styles.skip, page === LAST_PAGE && styles.hidden]}
        >
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
        </PressableScale>
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
        scrollEnabled={!formOpen}
        style={styles.pager}
      >
        <Page
          index={0}
          scrollX={scrollX}
          width={width}
          footer={
            <View style={styles.footerStack}>
              <Button
                size='lg'
                onPress={() => goTo(1)}
                icon={<ArrowRight size={20} color={colors.primaryForeground} />}
                iconPosition='right'
                style={styles.fullWidth}
              >
                Get started
              </Button>
              <Button
                variant='ghost'
                size='lg'
                onPress={() => goTo(LAST_PAGE)}
                style={styles.fullWidth}
                textStyle={{ color: colors.foreground }}
              >
                I already have an account
              </Button>
            </View>
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
              {`Continue with ${languages.size} ${languages.size === 1 ? 'language' : 'languages'}`}
            </Button>
          }
        >
          <LanguageStep selected={languages} onChange={setLanguages} />
        </Page>

        <Page index={2} scrollX={scrollX} width={width}>
          <AuthPanel
            active={page === LAST_PAGE}
            languages={languages}
            onFormOpenChange={setFormOpen}
          />
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
    gap: 14,
    paddingLeft: 16,
    paddingRight: 24,
    height: 40,
    marginBottom: 8,
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
  footerStack: {
    gap: 4,
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
