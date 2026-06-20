import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import React, { forwardRef, useState } from 'react';
import {
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

// Input variants
export type InputVariant = 'default' | 'outline' | 'filled' | 'ghost';
export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  variant?: InputVariant;
  size?: InputSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: boolean;
  errorText?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  className?: string;
  iconClassName?: string;
  labelText?: string;
}

const Input = forwardRef<TextInput, InputProps>(
  (
    {
      variant = 'default',
      size = 'md',
      leftIcon,
      rightIcon,
      error = false,
      errorText,
      containerStyle,
      inputStyle,
      className,
      iconClassName,
      labelText,
      placeholderTextColor,
      ...props
    },
    ref
  ) => {
    const { colors, theme } = useTheme();
    const [isFocused, setIsFocused] = useState(false);

    // Generate size-based styles
    const getSizeStyles = () => {
      switch (size) {
        case 'sm':
          return {
            input: 'h-8 px-3 text-sm',
            icon: 'h-8 w-8',
          };
        case 'lg':
          return {
            input: 'h-12 px-4 text-lg',
            icon: 'h-12 w-12',
          };
        case 'md':
        default:
          return {
            input: 'h-10 px-4',
            icon: 'h-10 w-10',
          };
      }
    };

    // Generate variant-based styles
    const getVariantStyles = () => {
      // Use a consistent border width to prevent layout shifts
      const borderWidth = variant === 'default' ? undefined : 1;

      switch (variant) {
        case 'outline':
          return {
            input: {
              backgroundColor: 'transparent',
              borderColor: error ? colors.destructive : isFocused ? colors.primary : colors.border,
              borderWidth,
            },
          };
        case 'filled':
          return {
            input: {
              backgroundColor:
                theme === 'light'
                  ? isFocused
                    ? 'rgba(0,0,0,0.02)'
                    : colors.muted
                  : isFocused
                    ? 'rgba(255,255,255,0.05)'
                    : colors.secondary,
              borderWidth,
              borderColor: isFocused ? colors.primary : 'transparent',
            },
          };
        case 'ghost':
          return {
            input: {
              backgroundColor: 'transparent',
              borderWidth: 0,
              borderBottomWidth: isFocused ? 1 : 0,
              borderBottomColor: isFocused ? colors.primary : undefined,
            },
          };
        case 'default':
        default:
          return {
            input: {
              backgroundColor: 'transparent',
              borderWidth: 0,
              borderBottomWidth: 1,
              borderBottomColor: error
                ? colors.destructive
                : isFocused
                  ? colors.primary
                  : colors.input,
            },
          };
      }
    };

    const sizeStyles = getSizeStyles();
    const variantStyles = getVariantStyles();

    // Default placeholder color based on theme
    const defaultPlaceholderColor = colors.mutedForeground;

    // Create a focus ring style for container instead of the input itself
    const containerFocusStyle = isFocused
      ? {
          borderColor: colors.primary,
        }
      : {};

    return (
      <View style={containerStyle} className={cn('w-full', className)}>
        {labelText && (
          <Text
            style={{ color: isFocused ? colors.primary : colors.foreground }}
            className='mb-2 text-sm font-medium'
          >
            {labelText}
          </Text>
        )}
        <View className='relative flex flex-row items-center w-full'>
          {leftIcon && (
            <View
              className={cn(
                'absolute left-0 flex items-center justify-center z-10 px-3',
                iconClassName
              )}
            >
              {leftIcon}
            </View>
          )}

          <TextInput
            ref={ref}
            style={{
              color: props.editable === false ? colors.mutedForeground : colors.foreground,
              width: '100%', // Explicitly set width to 100%
              flex: 1,
              ...variantStyles.input,
              ...(inputStyle as any),
            }}
            placeholderTextColor={placeholderTextColor || defaultPlaceholderColor}
            className={cn(
              'flex-1 rounded-md outline-none w-full',
              sizeStyles.input,
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              props.editable === false && 'opacity-70'
            )}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus && props.onFocus(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur && props.onBlur(e);
            }}
            {...props}
          />

          {rightIcon && (
            <View
              className={cn(
                'absolute right-0 flex items-center justify-center z-10 px-3',
                iconClassName
              )}
            >
              {rightIcon}
            </View>
          )}
        </View>

        {error && errorText && (
          <Text style={{ color: colors.destructive }} className='mt-1 text-xs'>
            {errorText}
          </Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

export { Input };
export default Input;
