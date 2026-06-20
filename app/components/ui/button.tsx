// src/components/ui/button.tsx
import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  TouchableOpacityProps,
  ActivityIndicator,
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
  Platform,
  Pressable,
  PressableProps,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';

// Button variants exactly matching shadcn/ui
export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';

// Button sizes
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

// Props for the Button component, matching shadcn/ui's API
export interface ButtonProps extends Omit<TouchableOpacityProps & PressableProps, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  title?: string;
  children?: React.ReactNode;
  className?: string; // For adding string-based styles (won't actually be used in RN)
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  size = 'default',
  isLoading = false,
  icon,
  iconPosition = 'left',
  title,
  children,
  disabled = false,
  style,
  textStyle,
  ...props
}) => {
  const { colors, theme } = useTheme();

  // Generate styles for different button variants (matching shadcn exactly)
  const getVariantStyles = (): {
    backgroundColor: string;
    color: string;
    borderColor?: string;
    borderWidth?: number;
  } => {
    switch (variant) {
      case 'default':
        return {
          backgroundColor: disabled ? colors.primaryDisabled : colors.primary,
          color: colors.primaryForeground,
        };
      case 'destructive':
        return {
          backgroundColor: disabled ? colors.destructiveDisabled : colors.destructive,
          color: colors.destructiveForeground,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: disabled ? colors.mutedForeground : colors.primary,
          borderColor: colors.border,
          borderWidth: 1,
        };
      case 'secondary':
        return {
          backgroundColor: disabled ? colors.secondaryDisabled : colors.secondary,
          color: colors.secondaryForeground,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: disabled ? colors.mutedForeground : colors.primary,
        };
      case 'link':
        return {
          backgroundColor: 'transparent',
          color: disabled ? colors.mutedForeground : colors.primary,
        };
      default:
        return {
          backgroundColor: colors.primary,
          color: colors.primaryForeground,
        };
    }
  };

  // Compute styles for different button sizes (matching shadcn sizes)
  const getSizeStyles = (): {
    paddingHorizontal: number;
    paddingVertical: number;
    fontSize: number;
    height?: number;
    width?: number;
  } => {
    switch (size) {
      case 'sm':
        return {
          paddingHorizontal: 12,
          paddingVertical: 6,
          fontSize: 13,
        };
      case 'lg':
        return {
          paddingHorizontal: 24,
          paddingVertical: 10,
          fontSize: 16,
        };
      case 'icon':
        return {
          paddingHorizontal: 0,
          paddingVertical: 0,
          fontSize: 14,
          height: 40,
          width: 40,
        };
      case 'default':
      default:
        return {
          paddingHorizontal: 16,
          paddingVertical: 8,
          fontSize: 14,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  // Get ripple color for Android
  const getRippleColor = () => {
    if (variant === 'outline' || variant === 'ghost' || variant === 'link') {
      // Matching the hover state of button in shadcn
      return Platform.select({
        android: theme === 'light' ? '#00000010' : '#FFFFFF10', // 10% opacity
        default: 'transparent',
      });
    }
    return Platform.select({
      android: theme === 'light' ? '#00000010' : '#FFFFFF20', // Subtle ripple
      default: 'transparent',
    });
  };

  // Content rendering
  const renderContent = () => {
    const content = title || children;

    // For icon-only button
    if (size === 'icon' && icon) {
      return (
        <View style={styles.iconOnly}>
          {isLoading ? <ActivityIndicator size='small' color={variantStyles.color} /> : icon}
        </View>
      );
    }

    // For text with optional icon
    return (
      <View style={[styles.contentContainer, { height: sizeStyles.height }]}>
        {isLoading ? (
          <ActivityIndicator size='small' color={variantStyles.color} style={styles.loader} />
        ) : (
          <>
            {icon && iconPosition === 'left' && <View style={styles.leftIcon}>{icon}</View>}

            {content && (
              <Text
                style={[
                  styles.text,
                  {
                    color: variantStyles.color,
                    fontSize: sizeStyles.fontSize,
                    textDecorationLine: variant === 'link' ? 'underline' : 'none',
                  },
                  textStyle,
                ]}
                numberOfLines={1}
              >
                {content}
              </Text>
            )}

            {icon && iconPosition === 'right' && <View style={styles.rightIcon}>{icon}</View>}
          </>
        )}
      </View>
    );
  };

  // Use Pressable on Android for ripple effect, TouchableOpacity on iOS
  const ButtonComponent = Platform.OS === 'android' ? Pressable : TouchableOpacity;

  // Common props for both button types
  const commonProps = {
    disabled: disabled || isLoading,
    accessibilityRole: 'button' as 'button',
    accessibilityState: { disabled: disabled || isLoading },
    ...props,
  };

  // Android-specific props
  const androidProps =
    Platform.OS === 'android'
      ? {
          android_ripple: {
            color: getRippleColor(),
            borderless: false,
            foreground: true,
          },
        }
      : {};

  return (
    <ButtonComponent
      {...commonProps}
      {...androidProps}
      style={[
        styles.button,
        {
          backgroundColor: variantStyles.backgroundColor,
          borderColor: variantStyles.borderColor,
          borderWidth: variantStyles.borderWidth,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          paddingVertical: sizeStyles.paddingVertical,
          opacity: disabled ? 0.5 : 1,
          height: sizeStyles.height,
          width: sizeStyles.width,
        },
        style,
      ]}
    >
      {renderContent()}
    </ButtonComponent>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 6, // shadcn uses radius-md which is generally 6px
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    minWidth: 32,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '500', // Medium weight like shadcn
    textAlign: 'center',
  },
  leftIcon: {
    marginRight: 8,
  },
  rightIcon: {
    marginLeft: 8,
  },
  loader: {
    alignSelf: 'center',
  },
  iconOnly: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
});

export default Button;
