import PressableScale from '@/components/ui/PressableScale';
import { BUTTON_PRESS_SCALE } from '@/lib/motion';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TOP_SCRIM = ['rgba(0,0,0,0.72)', 'rgba(0,0,0,0)'] as const;

/**
 * A video from the conversation, full screen, streamed from its link. The player's own controls
 * handle play, seek and full screen; the bar on top saves it or closes.
 */
const VideoViewer = ({
  uri,
  title,
  subtitle,
  onClose,
  onSave,
}: {
  uri: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onSave?: () => void;
}) => {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(uri, (created) => {
    created.play();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  return (
    <Modal
      visible
      animationType='fade'
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={styles.root}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit='contain'
          nativeControls
          allowsPictureInPicture={false}
        />
        {status === 'loading' ? (
          <View style={styles.center} pointerEvents='none'>
            <ActivityIndicator color='#fff' />
          </View>
        ) : null}
        {status === 'error' ? (
          <View style={styles.center} pointerEvents='none'>
            <Text style={styles.error}>This video can't be played. Try again later.</Text>
          </View>
        ) : null}

        <LinearGradient
          colors={TOP_SCRIM}
          style={[styles.bar, { paddingTop: insets.top + 8 }]}
          pointerEvents='box-none'
        >
          <PressableScale
            onPress={onClose}
            scaleTo={BUTTON_PRESS_SCALE}
            hitSlop={8}
            accessibilityRole='button'
            accessibilityLabel='Close'
            style={styles.barButton}
          >
            <Ionicons name='close' size={24} color='#fff' />
          </PressableScale>
          <View style={styles.titles}>
            {title ? (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {onSave ? (
            <PressableScale
              onPress={onSave}
              scaleTo={BUTTON_PRESS_SCALE}
              hitSlop={8}
              accessibilityRole='button'
              accessibilityLabel='Save to gallery'
              style={styles.barButton}
            >
              <Ionicons name='download-outline' size={22} color='#fff' />
            </PressableScale>
          ) : null}
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#fff', fontSize: 14, paddingHorizontal: 32, textAlign: 'center' },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingBottom: 24,
  },
  barButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1, minWidth: 0 },
  title: { color: '#fff', fontSize: 15, fontWeight: '600' },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 },
});

export default VideoViewer;
