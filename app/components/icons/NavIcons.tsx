import { memo } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * SyncVibe's own icons for the bottom bar and the mini player. 24 grid, rounded 1.9 strokes.
 * Each tab icon has an outline form and a filled one for the selected tab; the filled one cuts
 * its inner detail out in `knock` (the selected pill's colour) so it still reads at 23px.
 */
type IconProps = {
  size?: number;
  color: string;
  filled?: boolean;
  /** Colour of the cut-out detail on a filled icon. */
  knock?: string;
};

const STROKE = 1.9;

/** A house whose door is a small equaliser. */
export const HomeIcon = memo(function HomeIcon({ size = 23, color, filled, knock }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
      <Path
        d='M3.5 10.6 11 4.3a1.6 1.6 0 0 1 2 0l7.5 6.3V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z'
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin='round'
        fill={filled ? color : 'none'}
      />
      <Path
        d='M9.5 17.5v-2.5M12 17.5v-5M14.5 17.5v-3.5'
        stroke={filled ? knock : color}
        strokeWidth={filled ? 2 : STROKE}
        strokeLinecap='round'
      />
    </Svg>
  );
});

/** One record playing out to both sides: listening together. */
export const RoomsIcon = memo(function RoomsIcon({ size = 23, color, filled, knock }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
      {filled ? (
        <>
          <Circle cx={12} cy={12} r={5.4} fill={color} />
          <Circle cx={12} cy={12} r={1.3} fill={knock} />
        </>
      ) : (
        <>
          <Circle cx={12} cy={12} r={4.6} stroke={color} strokeWidth={STROKE} />
          <Circle cx={12} cy={12} r={1} fill={color} />
        </>
      )}
      <Path
        d='M5.4 7.6a8 8 0 0 0 0 8.8M18.6 7.6a8 8 0 0 1 0 8.8M2.9 5.4a12 12 0 0 0 0 13.2M21.1 5.4a12 12 0 0 1 0 13.2'
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap='round'
      />
    </Svg>
  );
});

/** Two spines and a record leaning on them. */
export const LibraryIcon = memo(function LibraryIcon({
  size = 23,
  color,
  filled,
  knock,
}: IconProps) {
  const fill = filled ? color : 'none';
  return (
    <Svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
      <Rect
        x={3.5}
        y={4}
        width={3.6}
        height={16}
        rx={1.2}
        stroke={color}
        strokeWidth={STROKE}
        fill={fill}
      />
      <Rect
        x={9}
        y={6.5}
        width={3.6}
        height={13.5}
        rx={1.2}
        stroke={color}
        strokeWidth={STROKE}
        fill={fill}
      />
      {filled ? (
        <>
          <Circle cx={17.2} cy={15.2} r={5.3} fill={color} />
          <Circle cx={17.2} cy={15.2} r={1.2} fill={knock} />
        </>
      ) : (
        <>
          <Circle cx={17.2} cy={15.2} r={4.4} stroke={color} strokeWidth={STROKE} />
          <Circle cx={17.2} cy={15.2} r={0.9} fill={color} />
        </>
      )}
    </Svg>
  );
});

/** A speech bubble holding a voice wave instead of three dots. */
export const MessagesIcon = memo(function MessagesIcon({
  size = 23,
  color,
  filled,
  knock,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
      <Path
        d='M12 3.8c4.8 0 8.5 3.3 8.5 7.6S16.8 19 12 19c-1 0-2-.1-2.9-.4L4.5 20.4l1.3-3.7a7.2 7.2 0 0 1-2.3-5.3c0-4.3 3.7-7.6 8.5-7.6z'
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin='round'
        fill={filled ? color : 'none'}
      />
      <Path
        d='M8.6 11.4v.4M10.9 9.6v4M13.2 10.4v2.4M15.5 11.2v.8'
        stroke={filled ? knock : color}
        strokeWidth={filled ? 2 : STROKE}
        strokeLinecap='round'
      />
    </Svg>
  );
});

/** A lens with a note inside: the orb when nothing is playing. */
export const SearchMusicIcon = memo(function SearchMusicIcon({ size = 25, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
      <Circle cx={10.5} cy={10.5} r={6.5} stroke={color} strokeWidth={2} />
      <Path d='m15.5 15.5 4.5 4.5' stroke={color} strokeWidth={2} strokeLinecap='round' />
      <Path
        d='M10 13V8.2l2.6-.8'
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <Circle cx={9} cy={13} r={1.1} fill={color} />
    </Svg>
  );
});

export const PlayIcon = memo(function PlayIcon({ size = 24, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox='0 0 24 24'>
      <Path
        d='M8 5.3c0-1.2 1.3-1.9 2.3-1.3l9 6.2c.9.6.9 1.9 0 2.5l-9 6.2c-1 .7-2.3 0-2.3-1.2z'
        fill={color}
      />
    </Svg>
  );
});

export const PauseIcon = memo(function PauseIcon({ size = 24, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox='0 0 24 24'>
      <Rect x={6} y={4.5} width={4.2} height={15} rx={1.6} fill={color} />
      <Rect x={13.8} y={4.5} width={4.2} height={15} rx={1.6} fill={color} />
    </Svg>
  );
});

export const NextIcon = memo(function NextIcon({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox='0 0 24 24'>
      <Path d='M5 7c0-1 1.1-1.6 1.9-1l7 5c.7.5.7 1.5 0 2l-7 5C6.1 18.6 5 18 5 17z' fill={color} />
      <Rect x={16} y={5.5} width={3} height={13} rx={1.5} fill={color} />
    </Svg>
  );
});
