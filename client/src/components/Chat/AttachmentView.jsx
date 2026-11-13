/* oxlint-disable jsx-a11y/media-has-caption -- people's own clips and videos come without captions */
import {
  Download,
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Pause,
  Play,
  Presentation,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getOptimizedImageUrl } from '@/Utils/Cloudinary';
import { extensionOf, fileFamily, formatBytes, formatDuration, typeLabel } from '@/lib/attachments';
import { refreshAttachment } from '@/lib/chat';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/stores/chatStore';

const FAMILY_ICON = {
  archive: FileArchive,
  sheet: FileSpreadsheet,
  slides: Presentation,
  code: FileCode,
  image: FileImage,
  video: FileVideo,
  document: FileText,
};

/** Files a browser tab can show; the rest are downloaded. */
export const previewable = (attachment) =>
  ['pdf', 'txt', 'md', 'csv', 'json', 'log'].includes(extensionOf(attachment?.name));

const MEDIA_WIDTH = 280;

/** How much of the file is uploaded, and a way to stop. Shown over or under a file being sent. */
const UploadRing = ({ progress, onCancel, className }) => {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  return (
    <button
      type='button'
      onClick={(e) => {
        e.stopPropagation();
        onCancel();
      }}
      aria-label={`Uploading, ${Math.round((progress ?? 0) * 100)}%. Cancel`}
      title='Cancel'
      className={cn(
        'group/ring relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-scrim/55 text-on-scrim backdrop-blur-sm',
        className
      )}
    >
      <svg viewBox='0 0 44 44' className='absolute inset-0 -rotate-90' aria-hidden='true'>
        <circle
          cx='22'
          cy='22'
          r={radius}
          fill='none'
          stroke='currentColor'
          strokeOpacity='0.25'
          strokeWidth='3'
        />
        <circle
          cx='22'
          cy='22'
          r={radius}
          fill='none'
          stroke='currentColor'
          strokeWidth='3'
          strokeLinecap='round'
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - (progress ?? 0))}
          className={cn(
            'transition-[stroke-dashoffset] duration-200',
            progress == null && 'animate-pulse'
          )}
        />
      </svg>
      <X className='h-4 w-4' />
    </button>
  );
};

const useUpload = (message) => useChatStore((s) => s.uploads[message.clientId]);

/** A photo or a video, as a picture in the bubble. Opens the viewer. */
const MediaTile = ({ message, pending, sending, onOpen, onCancel, rounded }) => {
  const attachment = message.attachment;
  const progress = useUpload(message);
  const video = attachment.kind === 'video';
  const ratio =
    attachment.width && attachment.height
      ? attachment.width / attachment.height
      : video
        ? 16 / 9
        : null;
  const legacy = !attachment.id;
  const src =
    message.localUrl ||
    (legacy ? getOptimizedImageUrl(attachment.url, { thumbnail: true }) : attachment.url);

  return (
    <div
      className={cn('relative block overflow-hidden bg-foreground/[0.06]', rounded)}
      style={
        ratio
          ? {
              aspectRatio: ratio,
              width: Math.min(MEDIA_WIDTH, attachment.width || MEDIA_WIDTH),
              maxHeight: 320,
            }
          : { maxWidth: MEDIA_WIDTH }
      }
    >
      <button
        type='button'
        onClick={() => !pending && onOpen(message)}
        disabled={pending}
        className='block h-full w-full cursor-pointer disabled:cursor-default'
        aria-label={video ? 'Play video' : 'Open photo'}
      >
        {video ? (
          src ? (
            <video
              src={`${src}#t=0.1`}
              preload='metadata'
              muted
              playsInline
              className='pointer-events-none h-full w-full object-cover'
              onError={() => !message.localUrl && refreshAttachment(message)}
            />
          ) : null
        ) : src ? (
          <img
            src={src}
            alt={attachment.name || ''}
            loading='lazy'
            decoding='async'
            className={cn('max-h-80 max-w-full object-cover', ratio && 'h-full w-full')}
            onError={() => !message.localUrl && refreshAttachment(message)}
          />
        ) : null}
      </button>

      {video && !pending && (
        <span className='pointer-events-none absolute inset-0 flex items-center justify-center'>
          <span className='flex h-12 w-12 items-center justify-center rounded-full bg-scrim/55 text-on-scrim backdrop-blur-sm'>
            <Play className='ml-0.5 h-5 w-5 fill-current' />
          </span>
        </span>
      )}
      {video && attachment.durationSec ? (
        <span className='pointer-events-none absolute bottom-1.5 left-1.5 rounded-full bg-scrim/55 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-on-scrim'>
          {formatDuration(attachment.durationSec)}
        </span>
      ) : null}

      {sending && (
        <span className='absolute inset-0 flex items-center justify-center bg-scrim/20'>
          <UploadRing progress={progress} onCancel={() => onCancel(message)} />
        </span>
      )}
    </div>
  );
};

/** Only one clip plays at a time. */
let playingAudio = null;

const AudioClip = ({ message, isOwn, pending, sending, onCancel }) => {
  const attachment = message.attachment;
  const progress = useUpload(message);
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(attachment.durationSec || 0);
  const src = message.localUrl || attachment.url;

  useEffect(
    () => () => {
      if (playingAudio === audioRef.current) playingAudio = null;
    },
    []
  );

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (playingAudio && playingAudio !== audio) playingAudio.pause();
    playingAudio = audio;
    audio.play().catch(() => setPlaying(false));
  };

  const seek = (value) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = (value / 1000) * duration;
    setTime(audio.currentTime);
  };

  const position = duration ? Math.min(1000, (time / duration) * 1000) : 0;

  return (
    <div className='flex w-64 max-w-full items-center gap-2.5'>
      {sending ? (
        <UploadRing progress={progress} onCancel={() => onCancel(message)} />
      ) : (
        <button
          type='button'
          onClick={toggle}
          disabled={!src}
          aria-label={playing ? 'Pause' : 'Play'}
          className={cn(
            'flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform active:scale-95',
            isOwn ? 'bg-primary-foreground text-primary' : 'bg-foreground text-background'
          )}
        >
          {playing ? (
            <Pause className='h-4.5 w-4.5 fill-current' />
          ) : (
            <Play className='ml-0.5 h-4.5 w-4.5 fill-current' />
          )}
        </button>
      )}
      <div className='min-w-0 flex-1'>
        <p className='truncate text-[13px] font-medium' title={attachment.name}>
          {attachment.name || 'Audio'}
        </p>
        <input
          type='range'
          min={0}
          max={1000}
          value={position}
          onChange={(e) => seek(Number(e.target.value))}
          disabled={pending || !duration}
          aria-label='Position'
          className={cn(
            'my-1 block h-1 w-full cursor-pointer appearance-none rounded-full bg-current/20 disabled:cursor-default',
            '[&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-current',
            '[&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-current'
          )}
          style={{
            background: `linear-gradient(to right, currentColor ${position / 10}%, color-mix(in srgb, currentColor 22%, transparent) ${position / 10}%)`,
          }}
        />
        <p className='text-[11px] tabular-nums opacity-70'>
          {playing || time > 0 ? formatDuration(time) : formatDuration(duration)}
          {' · '}
          {formatBytes(attachment.size)}
        </p>
      </div>
      {src && (
        <audio
          ref={audioRef}
          src={src}
          preload='none'
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setTime(0);
          }}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) =>
            Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)
          }
          onError={() => !message.localUrl && refreshAttachment(message)}
        />
      )}
    </div>
  );
};

/** A document or archive: what it is, how big, and ways to look at it or save it. */
const FileCard = ({ message, isOwn, pending, sending, onOpen, onDownload, onCancel }) => {
  const attachment = message.attachment;
  const progress = useUpload(message);
  const Icon = FAMILY_ICON[fileFamily(attachment.name)] ?? File;
  const canPreview = previewable(attachment);

  return (
    <div
      className={cn(
        'flex w-64 max-w-full items-center gap-3 rounded-xl p-2 pr-1.5',
        isOwn ? 'bg-primary-foreground/12' : 'bg-background/70 dark:bg-background/40'
      )}
    >
      <button
        type='button'
        disabled={pending}
        onClick={() => (canPreview ? onOpen(message) : onDownload(message))}
        className='flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left disabled:cursor-default'
        title={canPreview ? `Preview ${attachment.name}` : `Download ${attachment.name}`}
      >
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            isOwn ? 'bg-primary-foreground/15' : 'bg-foreground/[0.07]'
          )}
        >
          <Icon className='h-5 w-5' strokeWidth={1.75} />
        </span>
        <span className='min-w-0 flex-1'>
          <span className='block truncate text-[13px] font-medium leading-5'>
            {attachment.name}
          </span>
          <span className='block text-[11px] tabular-nums opacity-70'>
            {sending && progress != null
              ? `${formatBytes(Math.round(progress * attachment.size))} of ${formatBytes(attachment.size)}`
              : `${typeLabel(attachment.name)} · ${formatBytes(attachment.size)}`}
          </span>
        </span>
      </button>
      {sending ? (
        <UploadRing progress={progress} onCancel={() => onCancel(message)} className='h-9 w-9' />
      ) : pending ? null : (
        <button
          type='button'
          onClick={() => onDownload(message)}
          aria-label={`Download ${attachment.name}`}
          title='Download'
          className='flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-current/10'
        >
          <Download className='h-4 w-4' />
        </button>
      )}
    </div>
  );
};

/** Whatever a message carries, drawn for its kind. */
const AttachmentView = ({ message, isOwn, sending, mediaRounded, actions }) => {
  const kind = message.attachment?.kind ?? 'image';
  const pending = message.id == null;
  if (kind === 'image' || kind === 'video') {
    return (
      <MediaTile
        message={message}
        pending={pending}
        sending={sending}
        rounded={mediaRounded}
        onOpen={actions.openMedia}
        onCancel={actions.discard}
      />
    );
  }
  if (kind === 'audio') {
    return (
      <AudioClip
        message={message}
        isOwn={isOwn}
        pending={pending}
        sending={sending}
        onCancel={actions.discard}
      />
    );
  }
  return (
    <FileCard
      message={message}
      isOwn={isOwn}
      pending={pending}
      sending={sending}
      onOpen={actions.preview}
      onDownload={actions.download}
      onCancel={actions.discard}
    />
  );
};

export default AttachmentView;
