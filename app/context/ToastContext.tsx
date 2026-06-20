import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AlertCircle, Check, CheckCircle, Info } from 'lucide-react-native';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useTheme } from './ThemeContext';

// Toast types for different scenarios
export type ToastType = 'default' | 'success' | 'error' | 'info';

interface ToastOptions {
  type?: ToastType;
  duration?: number;
}

type ToastFunction = (message: string, options?: ToastOptions) => void;

// Define a global toast function that can be called anywhere
let globalToast: ToastFunction | null = null;

// Simple function to show toast without hooks
export const toast = (message: string, options?: ToastOptions) => {
  if (globalToast) {
    globalToast(message, options);
  } else {
    console.warn('Toast not initialized yet. Make sure ToastProvider is mounted.');
  }
};

interface ToastContextType {
  toast: ToastFunction;
}

interface ToastProviderProps {
  children: ReactNode;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const { colors } = useTheme();
  const [visible, setVisible] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [toastType, setToastType] = useState<ToastType>('default');

  // Animation properties
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(0)).current;

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationInProgressRef = useRef<boolean>(false);

  const getToastColor = useCallback(
    (type: ToastType) => {
      switch (type) {
        case 'success':
          return colors.primary;
        case 'error':
          return colors.destructive;
        case 'info':
          return colors.accent;
        default:
          return colors.primary;
      }
    },
    [colors]
  );

  const getToastIcon = useCallback(
    (type: ToastType) => {
      const size = 22;
      const color = getToastColor(type);
      const iconStyle = {
        transform: [
          {
            scale: iconScaleAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.8, 1.1, 1],
            }),
          },
        ],
      };

      switch (type) {
        case 'success':
          return (
            <Animated.View style={iconStyle}>
              <CheckCircle size={size} color={color} strokeWidth={2.5} />
            </Animated.View>
          );
        case 'error':
          return (
            <Animated.View style={iconStyle}>
              <AlertCircle size={size} color={color} strokeWidth={2.5} />
            </Animated.View>
          );
        case 'info':
          return (
            <Animated.View style={iconStyle}>
              <Info size={size} color={color} strokeWidth={2.5} />
            </Animated.View>
          );
        default:
          return (
            <Animated.View style={iconStyle}>
              <Check size={size} color={color} strokeWidth={2.5} />
            </Animated.View>
          );
      }
    },
    [getToastColor, iconScaleAnim]
  );

  // Enhanced pan responder for better swipe handling
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dx) > Math.abs(gestureState.dy * 2);
        },
        onPanResponderGrant: () => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
        },
        onPanResponderMove: Animated.event([null, { dx: swipeAnim }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_, gestureState) => {
          if (Math.abs(gestureState.dx) > 80) {
            const velocity = Math.sign(gestureState.dx) * Math.min(Math.abs(gestureState.vx), 5);
            Animated.decay(swipeAnim, {
              velocity: velocity,
              deceleration: 0.997,
              useNativeDriver: true,
            }).start(() => hideToast(false));
          } else {
            Animated.spring(swipeAnim, {
              toValue: 0,
              tension: 120,
              friction: 8,
              useNativeDriver: true,
            }).start();

            if (visible && !animationInProgressRef.current) {
              timeoutRef.current = setTimeout(() => {
                hideToast();
              }, 2000);
            }
          }
        },
      }),
    [swipeAnim, visible]
  );

  const showToast = useCallback(
    (msg: string, options?: ToastOptions) => {
      const type = options?.type || 'default';
      const duration = options?.duration || 3000;

      setMessage(msg);
      setToastType(type);
      setVisible(true);
      animationInProgressRef.current = true;

      swipeAnim.setValue(0);
      iconScaleAnim.setValue(0);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      Animated.parallel([
        Animated.spring(fadeAnim, {
          toValue: 1,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 120,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(iconScaleAnim, {
          toValue: 1,
          tension: 200,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start(() => {
        animationInProgressRef.current = false;
      });

      timeoutRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    },
    [fadeAnim, translateYAnim, scaleAnim, swipeAnim, iconScaleAnim]
  );

  const hideToast = useCallback(
    (withAnimation: boolean = true) => {
      if (animationInProgressRef.current) return;

      animationInProgressRef.current = true;

      if (withAnimation) {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(translateYAnim, {
            toValue: 20,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.95,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setVisible(false);
          animationInProgressRef.current = false;
        });
      } else {
        setVisible(false);
        animationInProgressRef.current = false;
      }
    },
    [fadeAnim, translateYAnim, scaleAnim]
  );

  useEffect(() => {
    globalToast = showToast;
    return () => {
      globalToast = null;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [showToast]);

  const toastColor = getToastColor(toastType);

  const contextValue = useMemo(
    () => ({
      toast: showToast,
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {visible && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: translateYAnim },
                { scale: scaleAnim },
                { translateX: swipeAnim },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <TouchableWithoutFeedback onPress={() => hideToast()}>
            <Card
              variant='default'
              className={cn(
                'flex-row items-center px-4 py-3',
                toastType === 'error' && 'border-destructive',
                toastType === 'success' && 'border-primary',
                toastType === 'info' && 'border-accent'
              )}
              style={[
                styles.toastCard,
                {
                  borderLeftWidth: 4,
                  borderLeftColor: getToastColor(toastType),
                  backgroundColor: colors.card,
                },
              ]}
            >
              <View style={styles.iconContainer}>{getToastIcon(toastType)}</View>
              <View style={styles.toastContent}>
                <Text
                  style={[
                    styles.toastText,
                    {
                      color: colors.cardForeground,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {message}
                </Text>
              </View>
            </Card>
          </TouchableWithoutFeedback>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    width: Dimensions.get('window').width - 40,
    maxWidth: 380,
    zIndex: 9999,
  },
  toastCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderRadius: 12,
  },
  iconContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: 28,
    height: 28,
  },
  toastContent: {
    flex: 1,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    letterSpacing: 0.2,
  },
});
