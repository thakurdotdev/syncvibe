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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/ui/card';
import { useTheme } from './ThemeContext';

export type ToastType = 'default' | 'success' | 'error' | 'info';

interface ToastOptions {
  type?: ToastType;
  duration?: number;
}

type ToastFunction = (message: string, options?: ToastOptions) => void;

let globalToast: ToastFunction | null = null;

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
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [toastType, setToastType] = useState<ToastType>('default');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(-80)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(0)).current;

  const timeoutRef = useRef<any>(null);
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
      const size = 18;
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
            toValue: -80,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.92,
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
    [swipeAnim, visible, hideToast]
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
      translateYAnim.setValue(-80);
      scaleAnim.setValue(0.92);
      fadeAnim.setValue(0);

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
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 120,
          friction: 9,
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
    [fadeAnim, translateYAnim, scaleAnim, swipeAnim, iconScaleAnim, hideToast]
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
              top: insets.top + 8,
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
              className="flex-row items-center px-4 py-3"
              style={[
                styles.toastCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                },
              ]}
            >
              <View style={[styles.iconContainer, { backgroundColor: getToastColor(toastType) + '1A' }]}>
                {getToastIcon(toastType)}
              </View>
              <View style={styles.toastContent}>
                <Text
                  style={[
                    styles.toastText,
                    {
                      color: colors.foreground,
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
    alignSelf: 'center',
    width: Dimensions.get('window').width - 32,
    maxWidth: 360,
    zIndex: 9999,
  },
  toastCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderRadius: 14,
  },
  iconContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  toastContent: {
    flex: 1,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
});
