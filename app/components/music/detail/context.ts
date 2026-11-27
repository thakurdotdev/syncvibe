import { createContext, useContext, type RefObject } from 'react';
import type { View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

export interface DetailContextValue {
  /** How far the page has scrolled. */
  scrollY: SharedValue<number>;
  /** Where the play buttons end, measured from the top of the page's content. */
  actionsBottom: SharedValue<number>;
  /** The top of the page's content, to measure the play buttons against. */
  contentRef: RefObject<View | null>;
  /** Whether a song row mounting now should animate in, and after how long. */
  rowDelay: (index: number) => number | null;
  /** The rows from `index` on are about to appear (a list was expanded): let them animate in. */
  revealFrom: (index: number) => void;
}

export const DetailContext = createContext<DetailContextValue | null>(null);

export const useDetail = () => {
  const value = useContext(DetailContext);
  if (!value) throw new Error('useDetail must be used inside a DetailScreen');
  return value;
};

/** For parts that also show outside a detail page. */
export const useOptionalDetail = () => useContext(DetailContext);
