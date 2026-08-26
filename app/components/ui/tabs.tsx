import { useTheme } from '@/context/ThemeContext';
import React, { memo, useCallback } from 'react';
import {
  FlatList,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  count?: number | string;
  icon?: (props: { size: number; color: string }) => React.ReactNode;
  disabled?: boolean;
}

export type TabsVariant = 'pills' | 'underlined' | 'segmented';
export type TabsSize = 'sm' | 'md' | 'lg';

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onTabChange: (tabId: T) => void;
  variant?: TabsVariant;
  size?: TabsSize;
  scrollable?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  tabStyle?: StyleProp<ViewStyle>;
  activeTabStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  activeTextStyle?: StyleProp<TextStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface SingleTabProps<T extends string> {
  tab: TabItem<T>;
  isActive: boolean;
  onPress: (id: T) => void;
  variant: TabsVariant;
  size: TabsSize;
  tabStyle?: StyleProp<ViewStyle>;
  activeTabStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  activeTextStyle?: StyleProp<TextStyle>;
}

const TabButton = memo(function TabButton<T extends string>({
  tab,
  isActive,
  onPress,
  variant,
  size,
  tabStyle,
  activeTabStyle,
  textStyle,
  activeTextStyle,
}: SingleTabProps<T>) {
  const { colors, theme } = useTheme();
  const scale = useSharedValue(1);
  const isDark = theme === 'dark';

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 350 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 350 });
  }, [scale]);

  const handlePress = useCallback(() => {
    if (!tab.disabled) {
      onPress(tab.id);
    }
  }, [tab.disabled, tab.id, onPress]);

  const isSmall = size === 'sm';
  const isLarge = size === 'lg';

  const paddingVertical = isSmall ? 6 : isLarge ? 10 : 8;
  const paddingHorizontal = isSmall ? 12 : isLarge ? 18 : 14;
  const fontSize = isSmall ? 12.5 : isLarge ? 15 : 13.5;

  const activeBg =
    variant === 'segmented' ? (isDark ? 'rgba(255,255,255,0.15)' : colors.card) : colors.primary;

  const inactiveBg =
    variant === 'segmented'
      ? 'transparent'
      : isDark
        ? 'rgba(255,255,255,0.06)'
        : 'rgba(0,0,0,0.04)';

  const activeTextColor = variant === 'segmented' ? colors.foreground : colors.primaryForeground;

  const inactiveTextColor = colors.mutedForeground;

  const activeBorderColor = variant === 'underlined' ? colors.primary : 'transparent';

  const iconColor = isActive ? activeTextColor : inactiveTextColor;

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={tab.disabled}
      accessibilityRole='tab'
      accessibilityState={{ selected: isActive, disabled: tab.disabled }}
      style={[
        styles.tabButton,
        {
          paddingVertical,
          paddingHorizontal,
          backgroundColor:
            variant === 'underlined' ? 'transparent' : isActive ? activeBg : inactiveBg,
          borderRadius: variant === 'underlined' ? 0 : 20,
          borderBottomWidth: variant === 'underlined' ? 2.5 : 0,
          borderBottomColor: activeBorderColor,
        },
        tabStyle,
        isActive && activeTabStyle,
        tab.disabled && { opacity: 0.4 },
        animatedStyle,
      ]}
    >
      <View style={styles.tabContent}>
        {tab.icon && tab.icon({ size: isSmall ? 14 : 16, color: iconColor })}

        <Text
          style={[
            styles.tabText,
            {
              fontSize,
              color: isActive ? activeTextColor : inactiveTextColor,
              fontWeight: isActive ? '700' : '600',
            },
            textStyle,
            isActive && activeTextStyle,
          ]}
          numberOfLines={1}
        >
          {tab.label}
        </Text>

        {tab.count !== undefined && tab.count !== null && (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: isActive
                  ? variant === 'segmented'
                    ? colors.primary + '25'
                    : 'rgba(255,255,255,0.22)'
                  : isDark
                    ? 'rgba(255,255,255,0.09)'
                    : 'rgba(0,0,0,0.07)',
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                {
                  fontSize: isSmall ? 10.5 : 11.5,
                  color: isActive ? activeTextColor : inactiveTextColor,
                },
              ]}
            >
              {tab.count}
            </Text>
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
}) as <T extends string>(props: SingleTabProps<T>) => React.ReactElement | null;

export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  variant = 'pills',
  size = 'md',
  scrollable = true,
  containerStyle,
  tabStyle,
  activeTabStyle,
  textStyle,
  activeTextStyle,
}: TabsProps<T>) {
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';

  const renderTab = useCallback(
    ({ item }: { item: TabItem<T> }) => (
      <TabButton
        tab={item}
        isActive={item.id === activeTab}
        onPress={onTabChange}
        variant={variant}
        size={size}
        tabStyle={tabStyle}
        activeTabStyle={activeTabStyle}
        textStyle={textStyle}
        activeTextStyle={activeTextStyle}
      />
    ),
    [activeTab, onTabChange, variant, size, tabStyle, activeTabStyle, textStyle, activeTextStyle]
  );

  const keyExtractor = useCallback((item: TabItem<T>) => item.id, []);

  if (!tabs || tabs.length === 0) return null;

  if (variant === 'segmented') {
    return (
      <View
        style={[
          styles.segmentedContainer,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
            borderColor: colors.border + '40',
          },
          containerStyle,
        ]}
      >
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTab}
            onPress={onTabChange}
            variant={variant}
            size={size}
            tabStyle={[{ flex: 1 }, tabStyle]}
            activeTabStyle={activeTabStyle}
            textStyle={textStyle}
            activeTextStyle={activeTextStyle}
          />
        ))}
      </View>
    );
  }

  if (scrollable) {
    return (
      <View style={[styles.container, containerStyle]}>
        <FlatList
          data={tabs}
          renderItem={renderTab}
          keyExtractor={keyExtractor}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        />
      </View>
    );
  }

  return (
    <View style={[styles.staticContainer, containerStyle]}>
      {tabs.map((tab) => (
        <TabButton
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTab}
          onPress={onTabChange}
          variant={variant}
          size={size}
          tabStyle={tabStyle}
          activeTabStyle={activeTabStyle}
          textStyle={textStyle}
          activeTextStyle={activeTextStyle}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  staticContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginVertical: 8,
    gap: 8,
  },
  segmentedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 24,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabText: {
    letterSpacing: -0.2,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontWeight: '700',
  },
});

export default memo(Tabs) as typeof Tabs;
