import { memo } from 'react';

/*
 * SyncVibe's own icons for the tabs and the mini player, the same drawings as the app's
 * (app/components/icons/NavIcons.tsx): 24 grid, rounded strokes. They draw in `currentColor`,
 * so text colour classes apply. Each tab icon has an outline form and a filled one for the
 * selected tab; the filled one cuts its inner detail out in `knock` (the selected pill's colour)
 * so it still reads small.
 */

const STROKE = 1.9;

const Svg = ({ size = 24, className, children, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    aria-hidden='true'
    className={className}
    {...rest}
  >
    {children}
  </svg>
);

/** A house whose door is a small equaliser. */
export const HomeIcon = memo(({ filled, knock, strokeWidth = STROKE, ...props }) => (
  <Svg {...props}>
    <path
      d='M3.5 10.6 11 4.3a1.6 1.6 0 0 1 2 0l7.5 6.3V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z'
      stroke='currentColor'
      strokeWidth={strokeWidth}
      strokeLinejoin='round'
      fill={filled ? 'currentColor' : 'none'}
    />
    <path
      d='M9.5 17.5v-2.5M12 17.5v-5M14.5 17.5v-3.5'
      stroke={filled ? knock : 'currentColor'}
      strokeWidth={filled ? 2 : strokeWidth}
      strokeLinecap='round'
    />
  </Svg>
));
HomeIcon.displayName = 'HomeIcon';

/** Headphones: listening, together in a room. */
export const RoomsIcon = memo(({ filled, knock: _knock, strokeWidth = STROKE, ...props }) => {
  const fill = filled ? 'currentColor' : 'none';
  return (
    <Svg {...props}>
      <path
        d='M4.5 14.5V12a7.5 7.5 0 0 1 15 0v2.5'
        stroke='currentColor'
        strokeWidth={strokeWidth}
        strokeLinecap='round'
      />
      <rect
        x={3.2}
        y={13.2}
        width={4.6}
        height={7.3}
        rx={2}
        stroke='currentColor'
        strokeWidth={strokeWidth}
        fill={fill}
      />
      <rect
        x={16.2}
        y={13.2}
        width={4.6}
        height={7.3}
        rx={2}
        stroke='currentColor'
        strokeWidth={strokeWidth}
        fill={fill}
      />
    </Svg>
  );
});
RoomsIcon.displayName = 'RoomsIcon';

/** A playlist: lines of songs and a note. */
export const LibraryIcon = memo(({ filled, knock: _knock, strokeWidth = STROKE, ...props }) => (
  <Svg {...props}>
    <path
      d='M3.5 6h11M3.5 11h11M3.5 16h6.5'
      stroke='currentColor'
      strokeWidth={filled ? 2.3 : strokeWidth}
      strokeLinecap='round'
    />
    <path
      d='M19 17.5V6.2l2.6 1.1'
      stroke='currentColor'
      strokeWidth={strokeWidth}
      strokeLinecap='round'
      strokeLinejoin='round'
    />
    <circle
      cx={16.5}
      cy={17.5}
      r={2.5}
      stroke='currentColor'
      strokeWidth={strokeWidth}
      fill={filled ? 'currentColor' : 'none'}
    />
  </Svg>
));
LibraryIcon.displayName = 'LibraryIcon';

/** A speech bubble with typing dots. */
export const MessagesIcon = memo(({ filled, knock, strokeWidth = STROKE, ...props }) => {
  const dot = filled ? knock : 'currentColor';
  return (
    <Svg {...props}>
      <path
        d='M12 3.8c4.8 0 8.5 3.3 8.5 7.6S16.8 19 12 19c-1 0-2-.1-2.9-.4L4.5 20.4l1.3-3.7a7.2 7.2 0 0 1-2.3-5.3c0-4.3 3.7-7.6 8.5-7.6z'
        stroke='currentColor'
        strokeWidth={strokeWidth}
        strokeLinejoin='round'
        fill={filled ? 'currentColor' : 'none'}
      />
      <circle cx={8.4} cy={11.4} r={1.15} fill={dot} />
      <circle cx={12} cy={11.4} r={1.15} fill={dot} />
      <circle cx={15.6} cy={11.4} r={1.15} fill={dot} />
    </Svg>
  );
});
MessagesIcon.displayName = 'MessagesIcon';

/** A lens with a note inside: the orb when nothing is playing. */
export const SearchMusicIcon = memo((props) => (
  <Svg {...props}>
    <circle cx={10.5} cy={10.5} r={6.5} stroke='currentColor' strokeWidth={2} />
    <path d='m15.5 15.5 4.5 4.5' stroke='currentColor' strokeWidth={2} strokeLinecap='round' />
    <path
      d='M10 13V8.2l2.6-.8'
      stroke='currentColor'
      strokeWidth={1.7}
      strokeLinecap='round'
      strokeLinejoin='round'
    />
    <circle cx={9} cy={13} r={1.1} fill='currentColor' />
  </Svg>
));
SearchMusicIcon.displayName = 'SearchMusicIcon';

export const PlayIcon = memo((props) => (
  <Svg {...props}>
    <path
      d='M8 5.3c0-1.2 1.3-1.9 2.3-1.3l9 6.2c.9.6.9 1.9 0 2.5l-9 6.2c-1 .7-2.3 0-2.3-1.2z'
      fill='currentColor'
    />
  </Svg>
));
PlayIcon.displayName = 'PlayIcon';

export const PauseIcon = memo((props) => (
  <Svg {...props}>
    <rect x={6} y={4.5} width={4.2} height={15} rx={1.6} fill='currentColor' />
    <rect x={13.8} y={4.5} width={4.2} height={15} rx={1.6} fill='currentColor' />
  </Svg>
));
PauseIcon.displayName = 'PauseIcon';

export const NextIcon = memo((props) => (
  <Svg {...props}>
    <path
      d='M5 7c0-1 1.1-1.6 1.9-1l7 5c.7.5.7 1.5 0 2l-7 5C6.1 18.6 5 18 5 17z'
      fill='currentColor'
    />
    <rect x={16} y={5.5} width={3} height={13} rx={1.5} fill='currentColor' />
  </Svg>
));
NextIcon.displayName = 'NextIcon';
