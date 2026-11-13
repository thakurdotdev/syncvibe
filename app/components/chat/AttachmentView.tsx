import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { toast } from '@/context/ToastContext';
import { fileIcon, formatBytes, formatDuration, typeLabel } from '@/lib/attachments';
import { refreshAttachment } from '@/lib/chat';
import { downloadToCache, openFile } from '@/lib/chatFiles';
import { BUTTON_PRESS_SCALE, ROW_PRESS_SCALE } from '@/lib/motion';
import { useChatStore, type ChatMessage } from '@/stores/chatStore';
import { getOptimizedImageUrl } from '@/utils/Cloudinary';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const MEDIA_WIDTH = 240;

/** A theme colour (#rrggbb) see-through by `alpha`. */
const fade = (hex: string, alpha: number) =>
  /^#[0-9a-f]{6}$/i.test(hex)
    ? `${hex}${Math.round(alpha * 255)
        .toString(16)
        .padStart(2, '0')}`
    : hex;
const LONG_PRESS_MS = 300;

interface AttachmentViewProps {
  message: ChatMessage;
  isOwn: boolean;
  /** Uploading right now. */
  sending: boolean;
  /** The bubble's corners, so a photo lines up with the run of messages it is in. */
  corners: ViewStyle;
  onOpenMedia: (message: ChatMessage) => void;
  onLongPress: (message: ChatMessage) => void;
  onCancel: (message: ChatMessage) => void;
}

/** How far along an upload or download is: a ring that fills, with a way to stop in the middle. */
const ProgressRing = ({
  progress,
  size = 44,
  color,
  track,
  children,
}: {
  progress: number | null | undefined;
  size?: number;
  color: string;
  track: string;
  children?: React.ReactNode;
}) => {
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={track}
          strokeWidth={stroke}
          fill='none'
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill='none'
          strokeLinecap='round'
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - Math.max(0.02, progress ?? 0))}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
};

const useUpload = (message: ChatMessage) => useChatStore((s) => s.uploads[message.clientId]);

/** A photo or a video, as a picture in the conversation. Tapping opens the viewer. */
const MediaTile = ({
  message,
  sending,
  corners,
  onOpenMedia,
  onLongPress,
  onCancel,
}: Omit<AttachmentViewProps, 'isOwn'>) => {
  const { colors } = useTheme();
  const progress = useUpload(message);
  const attachment = message.attachment!;
  const video = attachment.kind === 'video';
  const legacy = !attachment.id;
  const pending = message.id == null;
  const height =
    attachment.width && attachment.height
      ? Math.min(360, Math.max(120, (MEDIA_WIDTH * attachment.height) / attachment.width))
      : video
        ? (MEDIA_WIDTH * 9) / 16
        : MEDIA_WIDTH;
  const uri =
    message.localUrl ||
    (legacy ? getOptimizedImageUrl(attachment.url ?? '', { thumbnail: true }) : attachment.url);

  return (
    <PressableScale
      onPress={() => !pending && onOpenMedia(message)}
      onLongPress={() => onLongPress(message)}
      delayLongPress={LONG_PRESS_MS}
      scaleTo={ROW_PRESS_SCALE}
      accessibilityRole={video ? 'button' : 'imagebutton'}
      accessibilityLabel={`${video ? 'Video' : 'Photo'}. Tap to ${video ? 'play' : 'view'}, hold for options`}
    >
      <View
        style={[
          styles.media,
          corners,
          { height, backgroundColor: video ? '#0c0c0d' : colors.raised },
        ]}
      >
        {!video && uri ? (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            resizeMode='cover'
            fadeDuration={0}
            onError={() => !message.localUrl && refreshAttachment(message)}
          />
        ) : null}

        {video && !sending ? (
          <View style={styles.center}>
            <View style={styles.playBadge}>
              <Ionicons name='play' size={22} color='#fff' style={{ marginLeft: 3 }} />
            </View>
          </View>
        ) : null}
        {video && attachment.durationSec ? (
          <View style={styles.duration}>
            <Text style={styles.durationText}>{formatDuration(attachment.durationSec)}</Text>
          </View>
        ) : null}

        {sending ? (
          <View style={[styles.center, styles.dim]}>
            <PressableScale
              onPress={() => onCancel(message)}
              hitSlop={8}
              scaleTo={BUTTON_PRESS_SCALE}
              accessibilityRole='button'
              accessibilityLabel={`Uploading, ${Math.round((progress ?? 0) * 100)}%. Cancel`}
              style={styles.ringBackdrop}
            >
              <ProgressRing progress={progress} color='#fff' track='rgba(255,255,255,0.25)'>
                <Ionicons name='close' size={18} color='#fff' />
              </ProgressRing>
            </PressableScale>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
};

/** Only one clip plays at a time. */
let playingClip: AudioPlayer | null = null;

const ClipControls = ({
  uri,
  isOwn,
  duration: knownDuration,
  autoPlay,
  label,
  size,
}: {
  uri: string;
  isOwn: boolean;
  duration?: number;
  autoPlay: boolean;
  label: string;
  size?: number;
}) => {
  const { colors } = useTheme();
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  const started = useRef(false);

  useEffect(() => {
    if (!autoPlay || started.current) return;
    started.current = true;
    if (playingClip && playingClip !== player) playingClip.pause();
    playingClip = player;
    player.play();
  }, [autoPlay, player]);

  useEffect(
    () => () => {
      if (playingClip === player) playingClip = null;
    },
    [player]
  );

  useEffect(() => {
    if (status.didJustFinish) void player.seekTo(0);
  }, [status.didJustFinish, player]);

  const toggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (playingClip && playingClip !== player) playingClip.pause();
    playingClip = player;
    player.play();
  };

  const duration = status.duration || knownDuration || 0;
  const position = duration ? Math.min(1, status.currentTime / duration) : 0;
  const tint = isOwn ? colors.primaryForeground : colors.foreground;
  const [trackWidth, setTrackWidth] = useState(0);

  return (
    <ClipLayout
      tint={tint}
      button={<PlayButton isOwn={isOwn} playing={status.playing} onPress={toggle} label={label} />}
      label={label}
      position={position}
      onSeek={(x) => {
        if (duration && trackWidth) void player.seekTo((x / trackWidth) * duration);
      }}
      onTrackLayout={setTrackWidth}
      detail={`${formatDuration(status.playing || status.currentTime > 0 ? status.currentTime : duration)} · ${formatBytes(size)}`}
    />
  );
};

const PlayButton = ({
  isOwn,
  playing,
  onPress,
  label,
}: {
  isOwn: boolean;
  playing: boolean;
  onPress: () => void;
  label: string;
}) => {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={BUTTON_PRESS_SCALE}
      accessibilityRole='button'
      accessibilityLabel={`${playing ? 'Pause' : 'Play'} ${label}`}
      style={[
        styles.play,
        { backgroundColor: isOwn ? colors.primaryForeground : colors.foreground },
      ]}
    >
      <Ionicons
        name={playing ? 'pause' : 'play'}
        size={20}
        color={isOwn ? colors.primary : colors.background}
        style={playing ? null : { marginLeft: 2 }}
      />
    </PressableScale>
  );
};

const ClipLayout = ({
  tint,
  button,
  label,
  position,
  detail,
  onSeek,
  onTrackLayout,
}: {
  tint: string;
  button: React.ReactNode;
  label: string;
  position: number;
  detail: string;
  onSeek?: (x: number) => void;
  onTrackLayout?: (width: number) => void;
}) => (
  <View style={styles.clip}>
    {button}
    <View style={styles.clipBody}>
      <Text style={[styles.fileName, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
      <View
        style={styles.trackHit}
        onLayout={(e) => onTrackLayout?.(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => Boolean(onSeek)}
        onResponderRelease={(e) => onSeek?.(e.nativeEvent.locationX)}
      >
        <View style={[styles.track, { backgroundColor: tint, opacity: 0.22 }]} />
        <View
          style={[
            styles.track,
            styles.trackFill,
            { backgroundColor: tint, width: `${position * 100}%` },
          ]}
        />
      </View>
      <Text style={[styles.fileMeta, { color: tint }]}>{detail}</Text>
    </View>
  </View>
);

/** A song or a recording: plays in the bubble. The player is made only once it's first played. */
const AudioClip = ({ message, isOwn, sending, onCancel }: AttachmentViewProps) => {
  const { colors } = useTheme();
  const progress = useUpload(message);
  const attachment = message.attachment!;
  const [active, setActive] = useState(false);
  const uri = message.localUrl || attachment.url;
  const label = attachment.name || 'Audio';
  const tint = isOwn ? colors.primaryForeground : colors.foreground;

  if (active && uri) {
    return (
      <ClipControls
        uri={uri}
        isOwn={isOwn}
        duration={attachment.durationSec}
        autoPlay
        label={label}
        size={attachment.size}
      />
    );
  }

  return (
    <ClipLayout
      tint={tint}
      button={
        sending ? (
          <PressableScale
            onPress={() => onCancel(message)}
            scaleTo={BUTTON_PRESS_SCALE}
            accessibilityRole='button'
            accessibilityLabel='Cancel upload'
          >
            <ProgressRing progress={progress} color={tint} track={fade(tint, 0.25)}>
              <Ionicons name='close' size={18} color={tint} />
            </ProgressRing>
          </PressableScale>
        ) : (
          <PlayButton isOwn={isOwn} playing={false} onPress={() => setActive(true)} label={label} />
        )
      }
      label={label}
      position={0}
      detail={`${formatDuration(attachment.durationSec)} · ${formatBytes(attachment.size)}`}
    />
  );
};

/** A document or archive: what it is and how big. Tapping downloads it once and opens it. */
const FileCard = ({ message, isOwn, sending, onLongPress, onCancel }: AttachmentViewProps) => {
  const { colors } = useTheme();
  const upload = useUpload(message);
  const attachment = message.attachment!;
  const name = attachment.name || 'File';
  const pending = message.id == null;
  const [download, setDownload] = useState<number | null>(null);
  const tint = isOwn ? colors.primaryForeground : colors.foreground;

  const open = async () => {
    if (pending || download != null) return;
    setDownload(0);
    try {
      const { file } = await downloadToCache(message, setDownload);
      setDownload(null);
      await openFile(file, name);
    } catch (error) {
      setDownload(null);
      toast(
        error instanceof Error && error.message === 'no-app'
          ? `No app on this phone opens .${name.split('.').pop()} files. Hold the file to save it.`
          : "Couldn't open the file. Try again.",
        { type: 'error' }
      );
    }
  };

  const busy = sending ? upload : download;
  const detail =
    sending && upload != null && attachment.size
      ? `${formatBytes(Math.round(upload * attachment.size))} of ${formatBytes(attachment.size)}`
      : download != null && attachment.size
        ? `Opening… ${Math.round(download * 100)}%`
        : `${typeLabel(name)} · ${formatBytes(attachment.size)}`;

  return (
    <PressableScale
      onPress={open}
      onLongPress={() => onLongPress(message)}
      delayLongPress={LONG_PRESS_MS}
      scaleTo={ROW_PRESS_SCALE}
      accessibilityRole='button'
      accessibilityLabel={`${name}, ${typeLabel(name)}, ${formatBytes(attachment.size)}. Tap to open, hold for options`}
      style={styles.file}
    >
      <View style={[styles.fileIcon, { backgroundColor: fade(tint, 0.12) }]}>
        <MaterialCommunityIcons
          name={fileIcon(name, attachment.kind) as any}
          size={22}
          color={tint}
        />
      </View>
      <View style={styles.clipBody}>
        <Text style={[styles.fileName, { color: tint }]} numberOfLines={1} ellipsizeMode='middle'>
          {name}
        </Text>
        <Text style={[styles.fileMeta, { color: tint }]}>{detail}</Text>
      </View>
      {busy != null || sending ? (
        <PressableScale
          onPress={() => sending && onCancel(message)}
          disabled={!sending}
          scaleTo={BUTTON_PRESS_SCALE}
          hitSlop={8}
          accessibilityRole='button'
          accessibilityLabel={sending ? 'Cancel upload' : 'Downloading'}
        >
          <ProgressRing progress={busy} size={34} color={tint} track={fade(tint, 0.25)}>
            {sending ? <Ionicons name='close' size={15} color={tint} /> : null}
          </ProgressRing>
        </PressableScale>
      ) : pending ? null : (
        <View style={[styles.fileAction, { borderColor: fade(tint, 0.25) }]}>
          <Ionicons name='arrow-down' size={16} color={tint} />
        </View>
      )}
    </PressableScale>
  );
};

/** Whatever a message carries, drawn for its kind. */
const AttachmentView = (props: AttachmentViewProps) => {
  const { colors } = useTheme();
  const kind = props.message.attachment?.kind ?? 'image';
  if (kind === 'image' || kind === 'video') return <MediaTile {...props} />;

  return (
    <View
      style={[
        styles.card,
        props.corners,
        { backgroundColor: props.isOwn ? colors.primary : colors.raised },
      ]}
    >
      {kind === 'audio' ? <AudioClip {...props} /> : <FileCard {...props} />}
    </View>
  );
};

const RADIUS = 18;

const styles = StyleSheet.create({
  media: { width: MEDIA_WIDTH, borderRadius: RADIUS, overflow: 'hidden' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  dim: { backgroundColor: 'rgba(0,0,0,0.25)' },
  ringBackdrop: { borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)' },
  playBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  duration: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  durationText: { color: '#fff', fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  card: { width: 264, borderRadius: RADIUS, padding: 10 },
  clip: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clipBody: { flex: 1, minWidth: 0 },
  play: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  trackHit: { height: 16, justifyContent: 'center' },
  track: { position: 'absolute', left: 0, right: 0, height: 3, borderRadius: 2 },
  trackFill: { right: undefined, opacity: 1 },
  file: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fileIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: { fontSize: 14.5, fontWeight: '600' },
  fileMeta: { fontSize: 12, opacity: 0.72, marginTop: 2, fontVariant: ['tabular-nums'] },
  fileAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default React.memo(AttachmentView);
