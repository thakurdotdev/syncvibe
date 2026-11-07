/**
 * Windowing for long song lists. FlatList's default keeps ten screens rendered above and below,
 * which is a lot of rows and bitmaps to hold on a mid-range Android phone.
 */
export const SONG_LIST_WINDOW = {
  initialNumToRender: 12,
  maxToRenderPerBatch: 8,
  windowSize: 7,
} as const;
