// CustomDrawer.tsx
import React, { useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, Dimensions, ScrollView } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type {
  PanGestureHandlerEventPayload,
  GestureUpdateEvent,
  GestureStateChangeEvent,
} from 'react-native-gesture-handler';

// Get the screen dimensions
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Define default properties for the drawer
const DEFAULT_PEEK_HEIGHT = 150;
const DEFAULT_DRAWER_HEIGHT = SCREEN_HEIGHT * 0.7;

// --- TypeScript Definitions ---

// Define the types for the props that the component will accept
export interface CustomDrawerProps {
  children?: React.ReactNode;
  peekHeight?: number;
  drawerHeight?: number;
}

// Define the functions that will be exposed via the ref
export interface CustomDrawerRef {
  open: () => void;
  close: () => void;
  peek: () => void;
}

// --- Component ---

const CustomDrawer = forwardRef<CustomDrawerRef, CustomDrawerProps>(
  ({ children, peekHeight = DEFAULT_PEEK_HEIGHT, drawerHeight = DEFAULT_DRAWER_HEIGHT }, ref) => {
    // Define the snap points for the drawer
    const SNAP_POINT_FULL = 0;
    const SNAP_POINT_PEEK = drawerHeight - peekHeight;
    const SNAP_POINT_CLOSED = drawerHeight;

    const translateY = useSharedValue(SNAP_POINT_PEEK);
    const context = useSharedValue({ y: 0 });

    const panGesture = Gesture.Pan()
      .onStart(() => {
        context.value = { y: translateY.value };
      })
      .onUpdate((event: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
        translateY.value = event.translationY + context.value.y;
        translateY.value = Math.max(translateY.value, SNAP_POINT_FULL);
      })
      .onEnd((event: GestureStateChangeEvent<PanGestureHandlerEventPayload>) => {
        if (event.velocityY > 500) {
          if (translateY.value > SNAP_POINT_PEEK) {
            translateY.value = withSpring(SNAP_POINT_CLOSED, { damping: 15 });
          } else {
            translateY.value = withSpring(SNAP_POINT_PEEK, { damping: 15 });
          }
        } else if (event.velocityY < -500) {
          translateY.value = withSpring(SNAP_POINT_FULL, { damping: 15 });
        } else {
          if (translateY.value > SNAP_POINT_PEEK / 2 && translateY.value < SNAP_POINT_PEEK) {
            translateY.value = withSpring(SNAP_POINT_PEEK, { damping: 15 });
          } else if (translateY.value > SNAP_POINT_PEEK) {
            translateY.value = withSpring(SNAP_POINT_CLOSED, { damping: 15 });
          } else {
            translateY.value = withSpring(SNAP_POINT_FULL, { damping: 15 });
          }
        }
      });

    const rDrawerStyle = useAnimatedStyle(() => {
      return {
        transform: [{ translateY: translateY.value + (SCREEN_HEIGHT - drawerHeight) }],
      };
    });

    useImperativeHandle(ref, () => ({
      open: () => (translateY.value = withSpring(SNAP_POINT_FULL, { damping: 15 })),
      close: () => (translateY.value = withSpring(SNAP_POINT_CLOSED, { damping: 15 })),
      peek: () => (translateY.value = withSpring(SNAP_POINT_PEEK, { damping: 15 })),
    }));

    return (
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.drawerContainer, { height: drawerHeight }, rDrawerStyle]}>
          <View style={styles.handle} />
          <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Animated.View>
      </GestureDetector>
    );
  }
);

const styles = StyleSheet.create({
  drawerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#222',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 10,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 4,
    backgroundColor: 'grey',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
});

export default CustomDrawer;
