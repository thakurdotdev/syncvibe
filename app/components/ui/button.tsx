import React, { useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  title?: string;
  children?: React.ReactNode;
  className?: string;
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
  const [isPressed, setIsPressed] = useState(false);
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    setIsPressed(true);
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      tension: 100,
      friction: 5,
    }).start();
  };

  const handlePressOut = () => {
    setIsPressed(false);
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 5,
    }).start();
  };

  const getVariantStyles = (isPressed: boolean): {
    backgroundColor: string;
    color: string;
    borderColor?: string;
    borderWidth?: number;
  } => {
    switch (variant) {
      case 'default':
        return {
          backgroundColor: disabled
            ? colors.primaryDisabled
            : isPressed
              ? colors.primaryActive
              : colors.primary,
          color: colors.primaryForeground,
        };
      case 'destructive':
        return {
          backgroundColor: disabled
            ? colors.destructiveDisabled
            : isPressed
              ? colors.destructiveActive
              : colors.destructive,
          color: colors.destructiveForeground,
        };
      case 'outline':
        return {
          backgroundColor: isPressed
            ? theme === 'light'
              ? 'rgba(0, 0, 0, 0.03)'
              : 'rgba(255, 255, 255, 0.05)'
            : 'transparent',
          color: disabled ? colors.mutedForeground : colors.primary,
          borderColor: isPressed ? colors.primary : colors.border,
          borderWidth: 1,
        };
      case 'secondary':
        return {
          backgroundColor: disabled
            ? colors.secondaryDisabled
            : isPressed
              ? colors.secondaryActive
              : colors.secondary,
          color: colors.secondaryForeground,
        };
      case 'ghost':
        return {
          backgroundColor: isPressed
            ? theme === 'light'
              ? 'rgba(0, 0, 0, 0.03)'
              : 'rgba(255, 255, 255, 0.05)'
            : 'transparent',
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
          paddingHorizontal: 14,
          paddingVertical: 0,
          fontSize: 13,
          height: 36,
        };
      case 'lg':
        return {
          paddingHorizontal: 28,
          paddingVertical: 0,
          fontSize: 16,
          height: 54,
        };
      case 'icon':
        return {
          paddingHorizontal: 0,
          paddingVertical: 0,
          fontSize: 14,
          height: 44,
          width: 44,
        };
      case 'default':
      default:
        return {
          paddingHorizontal: 20,
          paddingVertical: 0,
          fontSize: 15,
          height: 46,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  const getRippleColor = () => {
    if (variant === 'outline' || variant === 'ghost' || variant === 'link') {
      return Platform.select({
        android: theme === 'light' ? '#00000010' : '#FFFFFF10',
        default: 'transparent',
      });
    }
    return Platform.select({
      android: theme === 'light' ? '#00000010' : '#FFFFFF20',
      default: 'transparent',
    });
  };

  const renderContent = (isPressed: boolean) => {
    const variantStyles = getVariantStyles(isPressed);
    const content = title || children;

    if (size === 'icon' && icon) {
      return (
        <View style={styles.iconOnly}>
          {isLoading ? <ActivityIndicator size='small' color={variantStyles.color} /> : icon}
        </View>
      );
    }

    return (
      <View style={[styles.contentContainer, { height: sizeStyles.height }]}>
        {isLoading ? (
          <ActivityIndicator size='small' color={variantStyles.color} style={styles.loader} />
        ) : (
          <>
            {icon && iconPosition === 'left' && <View style={styles.leftIcon}>{icon}</View>}

            {content && typeof content === 'string' ? (
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
            ) : (
              content
            )}

            {icon && iconPosition === 'right' && <View style={styles.rightIcon}>{icon}</View>}
          </>
        )}
      </View>
    );
  };

  const commonProps = {
    disabled: disabled || isLoading,
    accessibilityRole: 'button' as 'button',
    accessibilityState: { disabled: disabled || isLoading },
    ...props,
  };

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

  const variantStyles = getVariantStyles(isPressed);
  const buttonStyle = [
    styles.button,
    {
      backgroundColor: variantStyles.backgroundColor,
      borderColor: variantStyles.borderColor,
      borderWidth: variantStyles.borderWidth,
      paddingHorizontal: sizeStyles.paddingHorizontal,
      height: sizeStyles.height,
      width: sizeStyles.width,
      opacity: disabled ? 0.5 : 1,
      borderRadius: 12,
      transform: [{ scale }] as any,
    },
    style,
  ];

  return (
    <AnimatedPressable
      {...commonProps}
      {...androidProps}
      onPressIn={(e) => {
        handlePressIn();
        props.onPressIn && props.onPressIn(e);
      }}
      onPressOut={(e) => {
        handlePressOut();
        props.onPressOut && props.onPressOut(e);
      }}
      style={buttonStyle}
    >
      {renderContent(isPressed)}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  button: {
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
    fontWeight: '600',
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
