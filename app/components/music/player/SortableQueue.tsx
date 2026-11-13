import { useTheme } from '@/context/ThemeContext';
import { PRESS_IN, SPRING_PRESS, STATE } from '@/lib/motion';
import { EDGE_GUARD, SWIPE_ACTIVATE } from '@/lib/swipe';
import { Trash2 } from '@/components/ui/icons';
import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  scrollTo,
  useAnimatedReaction,
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

const LIFT_DELAY_MS = 200;
const LIFT_SCALE = 1.03;
/** Finger this close to the top or bottom edge scrolls the list, up to this speed. */
const AUTOSCROLL_EDGE = 70;
const AUTOSCROLL_MAX_SPEED = 9;
/** Rows mount in blocks around the viewport so long queues stay light. Two blocks above, so a
 * fling back up has rows ready too. */
const WINDOW_BLOCK = 8;
const BLOCKS_BEFORE = 2;
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
  /** The row being swiped away, and how far. */
  swipeId: SharedValue<string | null>;
  swipeX: SharedValue<number>;
  /** Rows swiped all the way out, held off-screen until the data drops them. */
  removing: SharedValue<Record<string, true>>;
};

/**
 * One row: a single animated view and nothing else. The gestures live once on the list, so
 * mounting a row while the list scrolls costs no gesture handlers and no worklet callbacks.
 */
function SortableRowInner<T extends Sortable>({
  item,
  index,
  rowHeight,
  rowWidth,
  isDragging,
  renderRow,
  drag,
}: {
  item: T;
  index: number;
  rowHeight: number;
  rowWidth: number;
  isDragging: boolean;
  renderRow: (item: T, isActive: boolean) => ReactNode;
  drag: DragState;
}) {
  const id = item.id;
  // Pull out only what the style reads. An animated style re-runs when any shared value in its
  // closure changes, including those nested in an object.
  const { positions, activeId, lastActiveId, dragY, swipeId, swipeX, removing } = drag;
  const slotY = useSharedValue((positions.get()[id] ?? index) * rowHeight);
  const lift = useSharedValue(1);

  // Animations start only when this row's slot or lift actually changes, never on mount.
  useAnimatedReaction(
    () => ({ slot: (positions.get()[id] ?? index) * rowHeight, active: activeId.get() === id }),
    (now, prev) => {
      if (prev === null) {
        slotY.set(now.slot);
        return;
      }
      if (now.active !== prev.active) {
        lift.set(withTiming(now.active ? LIFT_SCALE : 1, PRESS_IN));
        if (!now.active) {
          // Dropped: glide from under the finger to its slot. The drop changes no layout, so
          // React committing the new order can't move anything on screen.
          slotY.set(dragY.get());
          slotY.set(withTiming(now.slot, STATE));
          return;
        }
      }
      if (!now.active && now.slot !== prev.slot) slotY.set(withTiming(now.slot, STATE));
    },
    [id, index, rowHeight]
  );

  const rowStyle = useAnimatedStyle(() => {
    const active = activeId.get() === id;
    const x = removing.get()[id] ? -rowWidth : swipeId.get() === id ? swipeX.get() : 0;
    return {
      zIndex: active || lastActiveId.get() === id ? 10 : 0,
      transform: [
        { translateY: active ? dragY.get() : slotY.get() },
        { translateX: x },
        { scale: lift.get() },
      ],
    };
  });

  return (
    <Animated.View style={[styles.row, { height: rowHeight }, rowStyle]}>
      {renderRow(item, isDragging)}
    </Animated.View>
  );
}

const SortableRow = memo(SortableRowInner) as typeof SortableRowInner;

/**
 * Queue list with long-press reordering and swipe left to remove. Rows are absolutely positioned by a UI-thread map
 * (song id → index), so a drag never touches layout and a drop only has to tell the store the
 * new order. That is what keeps it steady: list libraries that re-lay rows out after a drop
 * briefly paint the new order with the old drag offset still applied.
 *
 * The lift and swipe gestures are attached once, to the list, and find their row from where the
 * touch lands. With a detector per row, every block of rows mounted mid-scroll registered a
 * dozen gesture handlers and their worklets, which is what made scrolling stall and fall behind.
 */
function SortableQueueInner<T extends Sortable>({
  data,
  rowHeight,
  bottomPadding,
  canDrag,
  renderRow,
  onReorder,
  onRemove,
  pullGesture,
  scrollOffset,
}: {
  data: T[];
  rowHeight: number;
  bottomPadding: number;
  canDrag: (item: T) => boolean;
  renderRow: (item: T, isActive: boolean) => ReactNode;
  onReorder: (items: T[]) => void;
  onRemove: (id: string) => void;
  /** A vertical pull over the whole list. The list waits for it to fail before it scrolls. */
  pullGesture?: GestureType;
  /** Receives the scroll offset on the UI thread. */
  scrollOffset?: SharedValue<number>;
}) {
  const { colors } = useTheme();
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
  const swipeId = useSharedValue<string | null>(null);
  const swipeX = useSharedValue(0);
  const removing = useSharedValue<Record<string, true>>({});
  /** Rows that can't be moved or removed (what's playing now). */
  const locked = useSharedValue<Record<string, true>>({});
  /** The row under the finger when the touch began. */
  const touchId = useSharedValue<string | null>(null);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [firstBlock, setFirstBlock] = useState(0);
  const [mountLimit, setMountLimit] = useState(FIRST_PAINT_ROWS);

  /** A row is lifted and the store hasn't been told its new order yet. */
  const held = useSharedValue(false);

  const drag = useMemo<DragState>(
    () => ({ positions, activeId, lastActiveId, dragY, swipeId, swipeX, removing }),
    [positions, activeId, lastActiveId, dragY, swipeId, swipeX, removing]
  );

  // Songs added or removed while nothing is being dragged: rows glide to their new places.
  useEffect(() => {
    count.set(data.length);
    if (!held.get()) positions.set(toPositions(data));
    // Forget swipes on rows that are gone, so a row put back (undo) comes back in place.
    const present = new Set(data.map((item) => item.id));
    const swiped = swipeId.get();
    if (swiped !== null && !present.has(swiped)) {
      swipeId.set(null);
      swipeX.set(0);
    }
    const hidden = removing.get();
    if (Object.keys(hidden).some((id) => !present.has(id))) {
      const next: Record<string, true> = {};
      for (const id of Object.keys(hidden)) if (present.has(id)) next[id] = true;
      removing.set(next);
    }
  }, [data, count, held, positions, removing, swipeId, swipeX]);

  useEffect(() => {
    const next: Record<string, true> = {};
    for (const item of data) if (!canDrag(item)) next[item.id] = true;
    locked.set(next);
  }, [data, canDrag, locked]);

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

  // A normal update, not a transition: during a fling each new block would restart a pending
  // transition before it committed, and the rows coming into view stayed blank.
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
    scrollOffset?.set(e.contentOffset.y);
    const next = Math.floor(e.contentOffset.y / (rowHeight * WINDOW_BLOCK));
    if (next !== block.get()) {
      block.set(next);
      scheduleOnRN(setFirstBlock, next);
    }
  });

  const onLift = useCallback(
    (id: string) => {
      autoScroll.setActive(true);
      setDraggingId(id);
    },
    [autoScroll]
  );

  const onDrop = useCallback(
    (ids: string[]) => {
      held.set(false);
      autoScroll.setActive(false);
      setTimeout(() => setDraggingId(null), PRESS_LOCK_AFTER_DROP_MS);

      const current = data;
      const byId = new Map(current.map((item) => [item.id, item]));
      const ordered = ids.map((id) => byId.get(id)).filter((item): item is T => Boolean(item));
      // Songs that arrived mid-drag (auto recommendations) keep their place at the end.
      const known = new Set(ids);
      const next = [...ordered, ...current.filter((item) => !known.has(item.id))];

      positions.set(toPositions(next));
      if (next.some((item, i) => item.id !== current[i]?.id)) onReorder(next);
    },
    [autoScroll, data, held, onReorder, positions]
  );

  /** The movable row at `y` (relative to the list's top), if there is one. */
  const rowAt = useCallback(
    (y: number) => {
      'worklet';
      const index = Math.floor((y + scrollY.get()) / rowHeight);
      if (index < 0 || index >= count.get()) return null;
      const map = positions.get();
      for (const id of Object.keys(map)) {
        if (map[id] === index) return locked.get()[id] || removing.get()[id] ? null : id;
      }
      return null;
    },
    [count, locked, positions, removing, rowHeight, scrollY]
  );

  // Holding still lifts the row; moving left before that swipes it away.
  const rowGesture = useMemo(() => {
    const lift = Gesture.Pan()
      .activateAfterLongPress(LIFT_DELAY_MS)
      .onTouchesDown((e, state) => {
        const touch = e.allTouches[0];
        const id = touch ? rowAt(touch.y) : null;
        touchId.set(id);
        if (id === null) state.fail();
      })
      .onStart(() => {
        const id = touchId.get();
        if (id === null) return;
        const y = (positions.get()[id] ?? 0) * rowHeight;
        startY.set(y);
        dragY.set(y);
        startScroll.set(scrollY.get());
        translation.set(0);
        lastActiveId.set(id);
        activeId.set(id);
        held.set(true);
        scheduleOnRN(onLift, id);
      })
      .onUpdate((e) => {
        if (activeId.get() === null) return;
        translation.set(e.translationY);
        syncDrag();
      })
      .onFinalize(() => {
        if (activeId.get() === null) return;
        const map = positions.get();
        const ids = Object.keys(map).sort((a, b) => map[a] - map[b]);
        activeId.set(null);
        scheduleOnRN(onDrop, ids);
      });

    const swipe = Gesture.Pan()
      // A left swipe from the right edge is the system's back gesture, not a removal.
      .hitSlop({ left: -EDGE_GUARD, right: -EDGE_GUARD })
      .activeOffsetX(-SWIPE_ACTIVATE)
      .failOffsetX(12)
      .failOffsetY([-14, 14])
      .onTouchesDown((e, state) => {
        const touch = e.allTouches[0];
        if (!touch || rowAt(touch.y) === null) state.fail();
      })
      .onStart(() => {
        swipeId.set(touchId.get());
        swipeX.set(0);
      })
      .onUpdate((e) => {
        const id = swipeId.get();
        // A song that starts playing mid-swipe can't be removed any more, so its row stays put.
        if (id === null || locked.get()[id]) {
          swipeX.set(0);
          return;
        }
        swipeX.set(Math.min(0, e.translationX));
      })
      .onEnd((e, success) => {
        const id = swipeId.get();
        if (id === null) return;
        const distance = -e.translationX;
        const speed = -e.velocityX;
        const remove =
          success &&
          !locked.get()[id] &&
          speed > -REMOVE_REVERSE_VELOCITY &&
          (distance >= rowWidth * REMOVE_DISTANCE ||
            (distance >= rowWidth * REMOVE_FLICK_DISTANCE && speed >= REMOVE_FLICK_VELOCITY));
        if (remove) {
          swipeX.set(
            withTiming(-rowWidth, STATE, (finished) => {
              if (!finished) return;
              removing.set({ ...removing.get(), [id]: true });
              scheduleOnRN(onRemove, id);
            })
          );
        } else {
          swipeX.set(withSpring(0, SPRING_PRESS));
        }
      });

    return Gesture.Race(lift, swipe);
  }, [
    activeId,
    dragY,
    held,
    lastActiveId,
    locked,
    onDrop,
    onLift,
    onRemove,
    positions,
    removing,
    rowAt,
    rowHeight,
    rowWidth,
    scrollY,
    startScroll,
    startY,
    swipeId,
    swipeX,
    syncDrag,
    touchId,
    translation,
  ]);

  // Waits just off-screen and is pulled in by the swiped row's right edge. It can't sit behind
  // the row, because rows are see-through, so it would show under the song's text.
  const removeStyle = useAnimatedStyle(() => {
    const id = swipeId.get();
    const slot = id === null ? 0 : (positions.get()[id] ?? 0);
    return {
      transform: [{ translateY: slot * rowHeight }, { translateX: rowWidth + swipeX.get() }],
    };
  });

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

  // What RNGH's own ScrollView sets up, plus the wait for the pull.
  const scrollGesture = useMemo(() => {
    const native = Gesture.Native().disallowInterruption(true).shouldCancelWhenOutside(false);
    return pullGesture ? native.requireExternalGestureToFail(pullGesture) : native;
  }, [pullGesture]);

  const list = (
    <GestureDetector gesture={rowGesture}>
      <View style={styles.fill} collapsable={false}>
        <GestureDetector gesture={scrollGesture}>
          <Animated.ScrollView
            ref={scrollRef}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onLayout={onLayout}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ height: data.length * rowHeight + bottomPadding }}
          >
            <Animated.View
              pointerEvents='none'
              style={[
                styles.remove,
                { width: rowWidth, height: rowHeight - 4, backgroundColor: colors.destructive },
                removeStyle,
              ]}
            >
              <Trash2 size={20} color={colors.destructiveForeground} />
            </Animated.View>
            {rows.map(({ item, index }) => (
              <SortableRow
                key={item.id}
                item={item}
                index={index}
                rowHeight={rowHeight}
                rowWidth={rowWidth}
                isDragging={item.id === draggingId}
                renderRow={renderRow}
                drag={drag}
              />
            ))}
          </Animated.ScrollView>
        </GestureDetector>
      </View>
    </GestureDetector>
  );

  if (!pullGesture) return list;
  return (
    <GestureDetector gesture={pullGesture}>
      <View style={styles.fill} collapsable={false}>
        {list}
      </View>
    </GestureDetector>
  );
}

export const SortableQueue = memo(SortableQueueInner) as typeof SortableQueueInner;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { position: 'absolute', left: 0, right: 0, top: 0 },
  remove: {
    position: 'absolute',
    top: 2,
    left: 0,
    borderRadius: 12,
    paddingLeft: 22,
    justifyContent: 'center',
  },
});
