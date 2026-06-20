import React from 'react';
import {
  View,
  Text,
  StyleProp,
  ViewStyle,
  TextStyle,
  TouchableOpacity,
  TouchableOpacityProps,
  Platform,
  Pressable,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

// Card variants
export type CardVariant = 'default' | 'outline' | 'secondary' | 'ghost';

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

// Main Card Component
//
// Elevation model: 'default' and 'secondary' use a soft drop shadow
// instead of a hairline border, per design direction. Shadow color is
// derived from the theme's own foreground token (not a flat black) so
// it reads correctly in both light and dark mode — a pure black shadow
// on a near-black dark background is invisible, so dark mode falls back
// to a very subtle border to preserve card separation where shadow
// alone can't do the job (iOS renders no shadow contrast on black-on-black,
// Android elevation does still work but looks inconsistent with iOS).
// 'outline' and 'ghost' remain genuinely border/transparent — some
// surfaces (nested cards, list rows) want zero elevation by design.
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
        shadowColor: colors.foreground,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: theme === 'light' ? 0.08 : 0.4,
        shadowRadius: 12,
      }
      : {
        elevation: 2,
        shadowColor: colors.cardForeground,
      };

  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'default':
        return {
          backgroundColor: colors.card,
          ...shadowStyles,
          // Dark mode keeps a faint border alongside the shadow — on a
          // near-black background, shadow contrast alone is too subtle
          // to separate the card from the page.
          ...(theme === 'dark' ? { borderWidth: 1, borderColor: colors.border } : null),
        };
      case 'secondary':
        return {
          backgroundColor: colors.secondary,
          ...shadowStyles,
          ...(theme === 'dark' ? { borderWidth: 1, borderColor: colors.border } : null),
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
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
          ...shadowStyles,
        };
    }
  };

  const variantStyles = getVariantStyles();

  // React Native constraint: iOS shadow props only render when
  // `overflow` is NOT 'hidden', but rounded-corner content clipping
  // requires 'hidden'. A single View can't do both at once, so
  // elevated variants split into an outer shadow-carrying View and an
  // inner content-clipping View. Bordered/flat variants skip the split
  // since they have nothing that needs clipping protection beyond what
  // the single View already does.
  const hasShadow = variant === 'default' || variant === 'secondary';

  if (hasShadow) {
    return (
      <View
        style={[
          {
            shadowColor: variantStyles.shadowColor,
            shadowOffset: variantStyles.shadowOffset,
            shadowOpacity: variantStyles.shadowOpacity,
            shadowRadius: variantStyles.shadowRadius,
            elevation: variantStyles.elevation,
            borderRadius: 16,
          },
          style,
        ]}
      >
        <View
          style={{
            backgroundColor: variantStyles.backgroundColor,
            borderColor: variantStyles.borderColor,
            borderWidth: variantStyles.borderWidth,
          }}
          {...props}
          className={cn('rounded-2xl overflow-hidden', className)}
        >
          {children}
        </View>
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
        },
        style,
      ]}
      {...props}
      className={cn('rounded-2xl overflow-hidden', className)}
    >
      {children}
    </View>
  );
};

export const CardHeader: React.FC<CardHeaderProps> = ({ style, children, className }) => {
  return (
    <View style={style} className={cn('p-4 pb-0', className)}>
      {children}
    </View>
  );
};

export const CardTitle: React.FC<CardTitleProps> = ({ style, children, className }) => {
  const { colors } = useTheme();

  return (
    <Text
      style={[{ color: colors.cardForeground }, style]}
      className={cn('text-lg font-semibold mb-1', className)}
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
      className={cn('text-sm mb-2', className)}
    >
      {children}
    </Text>
  );
};

export const CardContent: React.FC<CardContentProps> = ({ style, children, className }) => {
  return (
    <View style={style} className={cn('p-4 pt-2', className)}>
      {children}
    </View>
  );
};

export const CardFooter: React.FC<CardFooterProps> = ({ style, children, className }) => {
  return (
    <View style={style} className={cn('p-4 pt-0 flex-row justify-end gap-2', className)}>
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