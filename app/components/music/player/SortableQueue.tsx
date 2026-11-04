import { PRESS_IN, STATE } from '@/lib/motion';
import { Song } from '@/types/song';
import * as Haptics from 'expo-haptics';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

const LIFT_DELAY_MS = 200;
const LIFT_SCALE = 1.03;
/** Finger this close to the top or bottom edge scrolls the list, up to this speed. */
const AUTOSCROLL_EDGE = 70;
const AUTOSCROLL_MAX_SPEED = 9;
/** Rows mount in blocks around the viewport so long queues stay light. */
const WINDOW_BLOCK = 10;
const BLOCKS_BEFORE = 2;
const BLOCKS_AFTER = 3;
/** First paint mounts just a screenful so the switch to the queue stays smooth. */
const FIRST_PAINT_ROWS = 14;
const FULL_WINDOW_DELAY_MS = 260;
/** Rows stay unpressable this long after a drop, so lifting your finger can't play a song. */
const PRESS_LOCK_AFTER_DROP_MS = 150;

type Positions = Record<string, number>;

const toPositions = (songs: Song[]): Positions => {
  const out: Positions = {};
  songs.forEach((song, i) => {
    out[song.id] = i;
  });
  return out;
};

/** Moves `id` to index `to`, shifting only the rows it passed over. Exported for tests. */
export const moveInPositions = (positions: Positions, id: string, to: number): Positions => {
  'worklet';
  const from = positions[id];
  if (from === undefined || from === to) return positions;
  const next: Positions = {};
  for (const key of Object.keys(positions)) {
    const at = positions[key];
    if (key === id) next[key] = to;
    else if (from < to && at > from && at <= to) next[key] = at - 1;
    else if (from > to && at >= to && at < from) next[key] = at + 1;
    else next[key] = at;
  }
  return next;
};

type DragState = {
  positions: SharedValue<Positions>;
  activeId: SharedValue<string | null>;
  /** Last row dragged: stays on top while it settles into its slot. */
  lastActiveId: SharedValue<string | null>;
  dragY: SharedValue<number>;
  startY: SharedValue<number>;
  startScroll: SharedValue<number>;
  translation: SharedValue<number>;
  scrollY: SharedValue<number>;
  count: SharedValue<number>;
};

const SortableRow = memo(function SortableRow({
  song,
  index,
  rowHeight,
  draggable,
  drag,
  syncDrag,
  onLift,
  onDrop,
  children,
}: {
  song: Song;
  index: number;
  rowHeight: number;
  draggable: boolean;
  drag: DragState;
  syncDrag: () => void;
  onLift: (id: string) => void;
  onDrop: (ids: string[]) => void;
  children: ReactNode;
}) {
  const id = song.id;

  const pan = Gesture.Pan()
    .enabled(draggable)
    .activateAfterLongPress(LIFT_DELAY_MS)
    .onStart(() => {
      const y = (drag.positions.get()[id] ?? index) * rowHeight;
      drag.startY.set(y);
      drag.dragY.set(y);
      drag.startScroll.set(drag.scrollY.get());
      drag.translation.set(0);
      drag.lastActiveId.set(id);
      drag.activeId.set(id);
      scheduleOnRN(onLift, id);
    })
    .onUpdate((e) => {
      if (drag.activeId.get() !== id) return;
      drag.translation.set(e.translationY);
      syncDrag();
    })
    .onFinalize(() => {
      if (drag.activeId.get() !== id) return;
      const positions = drag.positions.get();
      const ids = Object.keys(positions).sort((a, b) => positions[a] - positions[b]);
      drag.activeId.set(null);
      scheduleOnRN(onDrop, ids);
    });

  const rowStyle = useAnimatedStyle(() => {
    const active = drag.activeId.get() === id;
    const onTop = active || drag.lastActiveId.get() === id;
    const slot = (drag.positions.get()[id] ?? index) * rowHeight;
    return {
      zIndex: onTop ? 10 : 0,
      transform: [
        // Every row, including the dropped one, just glides to its slot. The drop changes
        // no layout, so React committing the new order can't move anything on screen.
        { translateY: active ? drag.dragY.get() : withTiming(slot, STATE) },
        { scale: withTiming(active ? LIFT_SCALE : 1, PRESS_IN) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.row, { height: rowHeight }, rowStyle]}>
      <GestureDetector gesture={pan}>
        <View>{children}</View>
      </GestureDetector>
    </Animated.View>
  );
});

/**
 * Queue list with long-press reordering. Rows are absolutely positioned by a UI-thread map
 * (song id → index), so a drag never touches layout and a drop only has to tell the store the
 * new order. That is what keeps it steady: list libraries that re-lay rows out after a drop
 * briefly paint the new order with the old drag offset still applied.
 */
export const SortableQueue = memo(function SortableQueue({
  data,
  rowHeight,
  bottomPadding,
  canDrag,
  renderRow,
  onReorder,
}: {
  data: Song[];
  rowHeight: number;
  bottomPadding: number;
  canDrag: (song: Song) => boolean;
  renderRow: (song: Song, isActive: boolean) => ReactNode;
  onReorder: (songs: Song[]) => void;
}) {
  const scrollRef = useAnimatedRef<any>() as AnimatedRef<any>;
  const positions = useSharedValue<Positions>(toPositions(data));
  const activeId = useSharedValue<string | null>(null);
  const lastActiveId = useSharedValue<string | null>(null);
  const dragY = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScroll = useSharedValue(0);
  const translation = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const count = useSharedValue(data.length);
  const viewport = useSharedValue(0);
  const block = useSharedValue(0);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [firstBlock, setFirstBlock] = useState(0);
  const [fullWindow, setFullWindow] = useState(false);

  const dataRef = useRef(data);
  dataRef.current = data;
  const dragging = useRef(false);

  const drag = useMemo<DragState>(
    () => ({
      positions,
      activeId,
      lastActiveId,
      dragY,
      startY,
      startScroll,
      translation,
      scrollY,
      count,
    }),
    [positions, activeId, lastActiveId, dragY, startY, startScroll, translation, scrollY, count]
  );

  // Songs added or removed while nothing is being dragged: rows glide to their new places.
  useEffect(() => {
    count.set(data.length);
    if (!dragging.current) positions.set(toPositions(data));
  }, [data, count, positions]);

  useEffect(() => {
    const timer = setTimeout(() => setFullWindow(true), FULL_WINDOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  /** Puts the lifted row under the finger and moves the others out of its way. */
  const syncDrag = useCallback(() => {
    'worklet';
    const id = activeId.get();
    if (id === null) return;
    const raw = startY.get() + translation.get() + (scrollY.get() - startScroll.get());
    const lastRow = Math.max(0, (count.get() - 1) * rowHeight);
    const y = clamp(raw, 0, lastRow);
    dragY.set(y);
    const to = Math.round(y / rowHeight);
    if (to !== positions.get()[id]) positions.set(moveInPositions(positions.get(), id, to));
  }, [activeId, count, dragY, positions, rowHeight, scrollY, startScroll, startY, translation]);

  // Scrolls while the lifted row is held near an edge, faster the closer it gets.
  useFrameCallback(() => {
    if (activeId.get() === null) return;
    const top = dragY.get() - scrollY.get();
    const bottom = viewport.get() - (top + rowHeight);
    const pull =
      top < AUTOSCROLL_EDGE ? top - AUTOSCROLL_EDGE : Math.max(0, AUTOSCROLL_EDGE - bottom);
    if (pull === 0) return;
    const speed = clamp(pull / AUTOSCROLL_EDGE, -1, 1) * AUTOSCROLL_MAX_SPEED;
    const contentHeight = count.get() * rowHeight + bottomPadding;
    const maxScroll = Math.max(0, contentHeight - viewport.get());
    const next = clamp(scrollY.get() + speed, 0, maxScroll);
    if (next === scrollY.get()) return;
    scrollY.set(next);
    scrollTo(scrollRef, 0, next, false);
    syncDrag();
  });

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
    const next = Math.floor(e.contentOffset.y / (rowHeight * WINDOW_BLOCK));
    if (next !== block.get()) {
      block.set(next);
      scheduleOnRN(setFirstBlock, next);
    }
  });

  const onLift = useCallback((id: string) => {
    dragging.current = true;
    setDraggingId(id);
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const onDrop = useCallback(
    (ids: string[]) => {
      dragging.current = false;
      setTimeout(() => setDraggingId(null), PRESS_LOCK_AFTER_DROP_MS);

      const current = dataRef.current;
      const byId = new Map(current.map((song) => [song.id, song]));
      const ordered = ids.map((id) => byId.get(id)).filter((s): s is Song => Boolean(s));
      // Songs that arrived mid-drag (auto recommendations) keep their place at the end.
      const known = new Set(ids);
      const next = [...ordered, ...current.filter((song) => !known.has(song.id))];

      positions.set(toPositions(next));
      if (next.some((song, i) => song.id !== current[i]?.id)) onReorder(next);
    },
    [onReorder, positions]
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => viewport.set(e.nativeEvent.layout.height),
    [viewport]
  );

  const start = fullWindow ? Math.max(0, (firstBlock - BLOCKS_BEFORE) * WINDOW_BLOCK) : 0;
  const end = fullWindow
    ? (firstBlock + BLOCKS_AFTER + 1) * WINDOW_BLOCK
    : Math.min(data.length, FIRST_PAINT_ROWS);

  return (
    <AnimatedScrollView
      ref={scrollRef}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onLayout={onLayout}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ height: data.length * rowHeight + bottomPadding }}
    >
      {data.map((song, index) => {
        const inWindow = index >= start && index < end;
        // The lifted row stays mounted even when auto-scroll carries it out of the window.
        if (!inWindow && song.id !== draggingId) return null;
        return (
          <SortableRow
            key={song.id}
            song={song}
            index={index}
            rowHeight={rowHeight}
            draggable={canDrag(song)}
            drag={drag}
            syncDrag={syncDrag}
            onLift={onLift}
            onDrop={onDrop}
          >
            {renderRow(song, song.id === draggingId)}
          </SortableRow>
        );
      })}
    </AnimatedScrollView>
  );
});

const styles = StyleSheet.create({
  row: { position: 'absolute', left: 0, right: 0, top: 0 },
});
