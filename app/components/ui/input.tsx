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
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

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

    const getSizeStyles = (): {
      height: number;
      paddingHorizontal: number;
      fontSize: number;
    } => {
      switch (size) {
        case 'sm':
          return {
            height: 38,
            paddingHorizontal: 12,
            fontSize: 13,
          };
        case 'lg':
          return {
            height: 56,
            paddingHorizontal: 20,
            fontSize: 16,
          };
        case 'md':
        default:
          return {
            height: 48,
            paddingHorizontal: 16,
            fontSize: 15,
          };
      }
    };

    const getVariantStyles = (): ViewStyle => {
      const borderWidth = variant === 'default' ? 0 : 1;

      switch (variant) {
        case 'outline':
          return {
            backgroundColor: 'transparent',
            borderColor: error ? colors.destructive : isFocused ? colors.primary : colors.border,
            borderWidth,
          };
        case 'filled':
          return {
            backgroundColor:
              theme === 'light'
                ? isFocused
                  ? 'rgba(0,0,0,0.01)'
                  : colors.muted
                : isFocused
                  ? 'rgba(255,255,255,0.03)'
                  : colors.secondary,
            borderWidth: 1,
            borderColor: isFocused ? colors.primary : 'transparent',
          };
        case 'ghost':
          return {
            backgroundColor: 'transparent',
            borderWidth: 0,
            borderBottomWidth: isFocused ? 1.5 : 0,
            borderBottomColor: isFocused ? colors.primary : undefined,
          };
        case 'default':
        default:
          return {
            backgroundColor: 'transparent',
            borderWidth: 0,
            borderBottomWidth: 1.5,
            borderBottomColor: error
              ? colors.destructive
              : isFocused
                ? colors.primary
                : colors.input,
          };
      }
    };

    const sizeStyles = getSizeStyles();
    const variantStyles = getVariantStyles();
    const defaultPlaceholderColor = colors.mutedForeground;

    return (
      <View style={containerStyle} className={cn('w-full', className)}>
        {labelText && (
          <Text
            style={{
              color: isFocused ? colors.primary : colors.foreground,
              fontWeight: '600',
            }}
            className='mb-2 text-sm'
          >
            {labelText}
          </Text>
        )}
        <View className='relative flex flex-row items-center w-full'>
          {leftIcon && (
            <View
              style={{
                position: 'absolute',
                left: 0,
                width: sizeStyles.height,
                height: sizeStyles.height,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
              }}
              className={iconClassName}
            >
              {leftIcon}
            </View>
          )}

          <TextInput
            ref={ref}
            style={[
              {
                color: props.editable === false ? colors.mutedForeground : colors.foreground,
                width: '100%',
                flex: 1,
                height: sizeStyles.height,
                paddingLeft: leftIcon ? sizeStyles.height : sizeStyles.paddingHorizontal,
                paddingRight: rightIcon ? sizeStyles.height : sizeStyles.paddingHorizontal,
                fontSize: sizeStyles.fontSize,
                borderRadius: size === 'sm' ? 8 : size === 'lg' ? 16 : 12,
                ...variantStyles,
              },
              inputStyle,
            ]}
            placeholderTextColor={placeholderTextColor || defaultPlaceholderColor}
            className={cn(
              'flex-1 outline-none w-full',
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
              style={{
                position: 'absolute',
                right: 0,
                width: sizeStyles.height,
                height: sizeStyles.height,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
              }}
              className={iconClassName}
            >
              {rightIcon}
            </View>
          )}
        </View>

        {error && errorText && (
          <Text style={{ color: colors.destructive, fontWeight: '500' }} className='mt-1.5 text-xs'>
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
