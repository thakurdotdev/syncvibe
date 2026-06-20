import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';

const { height, width } = Dimensions.get('window');

interface SwipeableModalProps {
  isVisible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: number | 'auto' | `${number}%`;
  hideHandle?: boolean;
  backdropOpacity?: number;
  style?: ViewStyle;
  scrollable?: boolean;
  useScrollView?: boolean;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const SwipeableModal: React.FC<SwipeableModalProps> = ({
  isVisible,
  onClose,
  children,
  maxHeight = height * 0.8,
  hideHandle = false,
  backdropOpacity = 0.6,
  style,
  scrollable = false,
  useScrollView = false,
  onScroll,
}) => {
  const { colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [isAtScrollTop, setIsAtScrollTop] = useState(true);

  // Use Animated.Value for both position and backdrop opacity
  const animatedValue = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  const isClosingRef = useRef(false);
  const prevVisibleRef = useRef(isVisible);

  const closeModal = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      onClose();
    });
  }, [onClose, animatedValue]);

  // Interpolate animations
  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });

  const backdropOpacityAnim = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, backdropOpacity],
  });

  // Effect to handle modal visibility and animations
  useEffect(() => {
    if (isVisible && !prevVisibleRef.current) {
      isClosingRef.current = false;
      setModalVisible(true);
      Animated.spring(animatedValue, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else if (!isVisible && prevVisibleRef.current) {
      closeModal();
    }
    prevVisibleRef.current = isVisible;
  }, [isVisible, animatedValue, closeModal]);

  // Optimized scroll handling
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      setIsAtScrollTop(offsetY <= 0);
      onScroll?.(event);
    },
    [onScroll]
  );

  // Optimized pan responder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isVerticalSwipe = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);

        // Refined swipe conditions
        if (scrollable) {
          if (!isAtScrollTop && isVerticalSwipe && gestureState.dy < 0) {
            return false; // Prevent swipe when scrolling up
          }

          return isVerticalSwipe && (isAtScrollTop || gestureState.dy > 10);
        }

        return isVerticalSwipe;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          // Optionally map gesture to a fraction of the actual movement
          const mappedValue = Math.min(gestureState.dy / height, 1);
          animatedValue.setValue(1 - mappedValue);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > height * 0.3) {
          closeModal();
        } else {
          Animated.spring(animatedValue, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Memoized content wrapper
  const ContentWrapper = useCallback(
    (content: React.ReactNode) => {
      if (!scrollable || !useScrollView) return content;

      return (
        <ScrollView
          ref={scrollViewRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      );
    },
    [scrollable, useScrollView, handleScroll]
  );

  // Bail out early if not visible
  if (!modalVisible) return null;

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType='fade'
      statusBarTranslucent={true}
      onRequestClose={closeModal}
    >
      <View style={styles.modalContainer}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacityAnim,
            },
          ]}
        >
          <TouchableOpacity style={styles.backdropTouchable} activeOpacity={1} onPress={closeModal} />
        </Animated.View>
        <Animated.View
          style={[
            styles.drawerContainer,
            {
              backgroundColor: colors.card,
              maxHeight,
              transform: [{ translateY }],
            },
            style,
          ]}
          {...(scrollable && !useScrollView ? {} : panResponder.panHandlers)}
        >
          {!hideHandle && (
            <View style={styles.handleContainer} {...panResponder.panHandlers}>
              <View style={[styles.handle, { backgroundColor: colors.mutedForeground }]} />
            </View>
          )}
          {ContentWrapper(children)}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  backdropTouchable: {
    flex: 1,
  },
  drawerContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 30,
    width: '100%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
    zIndex: 10,
  },
  handle: {
    width: 48,
    height: 4,
    borderRadius: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});

export default React.memo(SwipeableModal);
