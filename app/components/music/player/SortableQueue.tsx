import { useTheme } from '@/context/ThemeContext';
import { PRESS_IN, SPRING_PRESS, STATE } from '@/lib/motion';
import { EDGE_GUARD, SWIPE_ACTIVATE } from '@/lib/swipe';
import { Trash2 } from 'lucide-react-native';
import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSpring,
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
const WINDOW_BLOCK = 8;
const BLOCKS_BEFORE = 1;
const BLOCKS_AFTER = 3;
/** First paint mounts just a screenful, then the rest in small steps, never all in one frame. */
const FIRST_PAINT_ROWS = 14;
const GROW_ROWS = 6;
const GROW_INTERVAL_MS = 50;
/** Rows stay unpressable this long after a drop, so lifting your finger can't play a song. */
const PRESS_LOCK_AFTER_DROP_MS = 150;
/** Removing is stricter than skipping: drag this share of the width, at any speed... */
const REMOVE_DISTANCE = 0.4;
/** ...or flick: this far, and this fast leftwards. */
const REMOVE_FLICK_DISTANCE = 0.2;
const REMOVE_FLICK_VELOCITY = 1000;
/** Moving back this fast at release means you changed your mind. */
const REMOVE_REVERSE_VELOCITY = 300;

type Positions = Record<string, number>;

/** What the queue needs from a row's item: the player's songs and a room's queue items both fit. */
type Sortable = { id: string };

const toPositions = (items: Sortable[]): Positions => {
  const out: Positions = {};
  items.forEach((item, i) => {
    out[item.id] = i;
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

function SortableRowInner<T extends Sortable>({
  item,
  index,
  rowHeight,
  rowWidth,
  draggable,
  isDragging,
  renderRow,
  drag,
  syncDrag,
  onLift,
  onDrop,
  onRemove,
}: {
  item: T;
  index: number;
  rowHeight: number;
  rowWidth: number;
  /** False for what's playing now: it can't be moved or removed. */
  draggable: boolean;
  isDragging: boolean;
  renderRow: (item: T, isActive: boolean) => ReactNode;
  drag: DragState;
  syncDrag: () => void;
  onLift: (id: string) => void;
  onDrop: (ids: string[]) => void;
  onRemove: (id: string) => void;
}) {
  const { colors } = useTheme();
  const id = item.id;
  const swipeX = useSharedValue(0);

  // A song that starts playing mid-swipe can't be removed any more, so put its row back.
  useEffect(() => {
    if (!draggable) swipeX.set(0);
  }, [draggable, swipeX]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
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
        }),
    [draggable, drag, id, index, onDrop, onLift, rowHeight, syncDrag]
  );

  // Holding still lifts the row (above); moving left before that swipes it away.
  const gesture = useMemo(
    () =>
      Gesture.Race(
        pan,
        Gesture.Pan()
          .enabled(draggable)
          // A left swipe from the right edge is the system's back gesture, not a removal.
          .hitSlop({ left: -EDGE_GUARD, right: -EDGE_GUARD })
          .activeOffsetX(-SWIPE_ACTIVATE)
          .failOffsetX(12)
          .failOffsetY([-14, 14])
          .onUpdate((e) => {
            swipeX.set(Math.min(0, e.translationX));
          })
          .onEnd((e, success) => {
            const distance = -e.translationX;
            const speed = -e.velocityX;
            const remove =
              success &&
              speed > -REMOVE_REVERSE_VELOCITY &&
              (distance >= rowWidth * REMOVE_DISTANCE ||
                (distance >= rowWidth * REMOVE_FLICK_DISTANCE && speed >= REMOVE_FLICK_VELOCITY));
            if (remove) {
              swipeX.set(
                withTiming(-rowWidth, STATE, (finished) => {
                  if (finished) scheduleOnRN(onRemove, id);
                })
              );
            } else {
              swipeX.set(withSpring(0, SPRING_PRESS));
            }
          })
      ),
    [draggable, id, onRemove, pan, rowWidth, swipeX]
  );

  // Pull out only what the style reads. An animated style re-runs when any shared value in its
  // closure changes, including those nested in an object: capturing `drag` whole would re-run
  // this for every mounted row on every scroll event, because `drag` holds the scroll position.
  const { positions, activeId, lastActiveId, dragY } = drag;
  const rowStyle = useAnimatedStyle(() => {
    const active = activeId.get() === id;
    const onTop = active || lastActiveId.get() === id;
    const slot = (positions.get()[id] ?? index) * rowHeight;
    return {
      zIndex: onTop ? 10 : 0,
      transform: [
        // Every row, including the dropped one, just glides to its slot. The drop changes
        // no layout, so React committing the new order can't move anything on screen.
        { translateY: active ? dragY.get() : withTiming(slot, STATE) },
        { scale: withTiming(active ? LIFT_SCALE : 1, PRESS_IN) },
      ],
    };
  });

  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateX: swipeX.get() }] }));
  // Waits just off-screen and is pulled in by the row's right edge. It can't sit behind the row,
  // because rows are see-through, so it would show under the song's text.
  const removeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: rowWidth + swipeX.get() }],
  }));

  return (
    <Animated.View style={[styles.row, { height: rowHeight }, rowStyle]}>
      {draggable && (
        <Animated.View
          pointerEvents='none'
          style={[
            styles.remove,
            { width: rowWidth, backgroundColor: colors.destructive },
            removeStyle,
          ]}
        >
          <Trash2 size={20} color={colors.destructiveForeground} />
        </Animated.View>
      )}
      <GestureDetector gesture={gesture}>
        <Animated.View style={contentStyle}>{renderRow(item, isDragging)}</Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const SortableRow = memo(SortableRowInner) as typeof SortableRowInner;

/**
 * Queue list with long-press reordering and swipe left to remove. Rows are absolutely positioned by a UI-thread map
 * (song id → index), so a drag never touches layout and a drop only has to tell the store the
 * new order. That is what keeps it steady: list libraries that re-lay rows out after a drop
 * briefly paint the new order with the old drag offset still applied.
 */
function SortableQueueInner<T extends Sortable>({
  data,
  rowHeight,
  bottomPadding,
  canDrag,
  renderRow,
  onReorder,
  onRemove,
}: {
  data: T[];
  rowHeight: number;
  bottomPadding: number;
  canDrag: (item: T) => boolean;
  renderRow: (item: T, isActive: boolean) => ReactNode;
  onReorder: (items: T[]) => void;
  onRemove: (id: string) => void;
}) {
  const { width: rowWidth } = useWindowDimensions();
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
  const [mountLimit, setMountLimit] = useState(FIRST_PAINT_ROWS);

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

  const fullWindowRows = (BLOCKS_AFTER + 1) * WINDOW_BLOCK;
  useEffect(() => {
    if (mountLimit === Infinity) return;
    const timer = setTimeout(() => {
      startTransition(() =>
        setMountLimit((n) => (n + GROW_ROWS >= fullWindowRows ? Infinity : n + GROW_ROWS))
      );
    }, GROW_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [fullWindowRows, mountLimit]);

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

  // Scrolls while the lifted row is held near an edge, faster the closer it gets. Only runs
  // during a drag: left on, it would ask for a frame for as long as the queue is mounted.
  const autoScroll = useFrameCallback(() => {
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
  }, false);

  // Mounting rows must never hold up a scroll, so it yields to anything more urgent.
  const moveWindow = useCallback((next: number) => {
    startTransition(() => setFirstBlock(next));
  }, []);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
    const next = Math.floor(e.contentOffset.y / (rowHeight * WINDOW_BLOCK));
    if (next !== block.get()) {
      block.set(next);
      scheduleOnRN(moveWindow, next);
    }
  });

  const onLift = useCallback(
    (id: string) => {
      dragging.current = true;
      autoScroll.setActive(true);
      setDraggingId(id);
    },
    [autoScroll]
  );

  const onDrop = useCallback(
    (ids: string[]) => {
      dragging.current = false;
      autoScroll.setActive(false);
      setTimeout(() => setDraggingId(null), PRESS_LOCK_AFTER_DROP_MS);

      const current = dataRef.current;
      const byId = new Map(current.map((item) => [item.id, item]));
      const ordered = ids.map((id) => byId.get(id)).filter((item): item is T => Boolean(item));
      // Songs that arrived mid-drag (auto recommendations) keep their place at the end.
      const known = new Set(ids);
      const next = [...ordered, ...current.filter((item) => !known.has(item.id))];

      positions.set(toPositions(next));
      if (next.some((item, i) => item.id !== current[i]?.id)) onReorder(next);
    },
    [autoScroll, onReorder, positions]
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => viewport.set(e.nativeEvent.layout.height),
    [viewport]
  );

  const start = Math.max(0, (firstBlock - BLOCKS_BEFORE) * WINDOW_BLOCK);
  const end = Math.min((firstBlock + BLOCKS_AFTER + 1) * WINDOW_BLOCK, mountLimit);

  const rows = useMemo(() => {
    const inWindow = data.slice(start, end).map((item, i) => ({ item, index: start + i }));
    // The lifted row stays mounted even when auto-scroll carries it out of the window.
    if (draggingId === null || inWindow.some((row) => row.item.id === draggingId)) return inWindow;
    const index = data.findIndex((item) => item.id === draggingId);
    return index < 0 ? inWindow : [...inWindow, { item: data[index], index }];
  }, [data, draggingId, end, start]);

  return (
    <AnimatedScrollView
      ref={scrollRef}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onLayout={onLayout}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ height: data.length * rowHeight + bottomPadding }}
    >
      {rows.map(({ item, index }) => (
        <SortableRow
          key={item.id}
          item={item}
          index={index}
          rowHeight={rowHeight}
          rowWidth={rowWidth}
          draggable={canDrag(item)}
          isDragging={item.id === draggingId}
          renderRow={renderRow}
          drag={drag}
          syncDrag={syncDrag}
          onLift={onLift}
          onDrop={onDrop}
          onRemove={onRemove}
        />
      ))}
    </AnimatedScrollView>
  );
}

export const SortableQueue = memo(SortableQueueInner) as typeof SortableQueueInner;

const styles = StyleSheet.create({
  row: { position: 'absolute', left: 0, right: 0, top: 0 },
  remove: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 0,
    borderRadius: 12,
    paddingLeft: 22,
    justifyContent: 'center',
  },
});
