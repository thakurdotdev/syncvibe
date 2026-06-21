import React from 'react';
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

export type CardVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'glass';

export interface CardProps {
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  className?: string;
}

export interface CardHeaderProps {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  className?: string;
}

export interface CardTitleProps {
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
  className?: string;
}

export interface CardDescriptionProps {
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
  className?: string;
}

export interface CardContentProps {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  className?: string;
}

export interface CardFooterProps {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  className?: string;
}

export interface CardActionProps extends TouchableOpacityProps {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  className?: string;
}

const CARD_BORDER_RADIUS = 12;

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  style,
  children,
  className,
  ...props
}) => {
  const { colors, theme } = useTheme();

  const shadowStyles =
    Platform.OS === 'ios'
      ? {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: theme === 'light' ? 0.08 : 0.4,
          shadowRadius: 12,
        }
      : {
          elevation: theme === 'light' ? 3 : 2,
          shadowColor: '#000000',
        };
 
  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'default':
        return {
          backgroundColor: colors.card,
        };
      case 'secondary':
        return {
          backgroundColor: colors.secondary,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: colors.border,
          borderWidth: 1,
        };
      case 'glass':
        return {
          backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(25, 25, 27, 0.5)',
          borderColor: colors.border,
          borderWidth: 1,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
        };
      default:
        return {
          backgroundColor: colors.card,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const hasShadow = variant === 'glass';
  const isGlass = variant === 'glass';

  const flattenedStyle = StyleSheet.flatten(style) || {};
  const radius = flattenedStyle.borderRadius !== undefined ? (flattenedStyle.borderRadius as number) : CARD_BORDER_RADIUS;

  const innerStyle = {
    backgroundColor: isGlass ? 'transparent' : variantStyles.backgroundColor,
    borderColor: variantStyles.borderColor,
    borderWidth: variantStyles.borderWidth,
  };

  if (hasShadow) {
    return (
      <View
        style={[
          {
            shadowColor: shadowStyles.shadowColor,
            shadowOffset: shadowStyles.shadowOffset,
            shadowOpacity: shadowStyles.shadowOpacity,
            shadowRadius: shadowStyles.shadowRadius,
            elevation: shadowStyles.elevation,
            borderRadius: radius,
          },
          style,
        ]}
      >
        {isGlass ? (
          <BlurView
            intensity={theme === 'light' ? 30 : 60}
            tint={theme}
            style={{ borderRadius: radius, overflow: 'hidden' }}
          >
            <View
              style={innerStyle}
              {...props}
              className={cn('overflow-hidden', className)}
            >
              {children}
            </View>
          </BlurView>
        ) : (
          <View
            style={[innerStyle, { borderRadius: radius }]}
            {...props}
            className={cn('overflow-hidden', className)}
          >
            {children}
          </View>
        )}
      </View>
    );
  }

  return (
    <View
      style={[
        {
          backgroundColor: variantStyles.backgroundColor,
          borderColor: variantStyles.borderColor,
          borderWidth: variantStyles.borderWidth,
          borderRadius: radius,
        },
        style,
      ]}
      {...props}
      className={cn('overflow-hidden', className)}
    >
      {children}
    </View>
  );
};

export const CardHeader: React.FC<CardHeaderProps> = ({ style, children, className }) => {
  return (
    <View style={style} className={cn('p-5 pb-0', className)}>
      {children}
    </View>
  );
};

export const CardTitle: React.FC<CardTitleProps> = ({ style, children, className }) => {
  const { colors } = useTheme();

  return (
    <Text
      style={[{ color: colors.cardForeground }, style]}
      className={cn('text-xl font-bold mb-1.5', className)}
    >
      {children}
    </Text>
  );
};

export const CardDescription: React.FC<CardDescriptionProps> = ({ style, children, className }) => {
  const { colors } = useTheme();

  return (
    <Text
      style={[{ color: colors.mutedForeground }, style]}
      className={cn('text-sm mb-2.5', className)}
    >
      {children}
    </Text>
  );
};

export const CardContent: React.FC<CardContentProps> = ({ style, children, className }) => {
  return (
    <View style={style} className={cn('p-5 pt-3', className)}>
      {children}
    </View>
  );
};

export const CardFooter: React.FC<CardFooterProps> = ({ style, children, className }) => {
  return (
    <View style={style} className={cn('p-5 pt-0 flex-row justify-end gap-2', className)}>
      {children}
    </View>
  );
};

export const CardAction: React.FC<CardActionProps> = ({ style, children, className, ...props }) => {
  const { theme } = useTheme();

  const getRippleColor = () => {
    return Platform.select({
      android: theme === 'light' ? '#00000010' : '#FFFFFF10',
      default: 'transparent',
    });
  };

  const ActionComponent = Platform.OS === 'android' ? Pressable : TouchableOpacity;

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
    <ActionComponent
      style={style}
      className={cn('rounded-md overflow-hidden', className)}
      {...androidProps}
      {...props}
    >
      {children}
    </ActionComponent>
  );
};

export default Object.assign(Card, {
  Header: CardHeader,
  Title: CardTitle,
  Description: CardDescription,
  Content: CardContent,
  Footer: CardFooter,
  Action: CardAction,
});