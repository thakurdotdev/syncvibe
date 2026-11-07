import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { fonts } from '@/theme/typography';
import { memo, useCallback, type ReactElement } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

/** Section heading used by every row: display face, optional "See all" on the right. */
export const SectionTitle = memo(function SectionTitle({
  title,
  onSeeAll,
}: {
  title?: string;
  onSeeAll?: () => void;
}) {
  const { colors } = useTheme();
  if (!title) return null;
  return (
    <View style={styles.titleRow}>
      <Text style={[styles.title, { color: colors.foreground }]} accessibilityRole='header'>
        {title}
      </Text>
      {onSeeAll && (
        <PressableScale
          onPress={onSeeAll}
          hitSlop={8}
          accessibilityRole='button'
          accessibilityLabel={`See all ${title}`}
          style={styles.seeAll}
        >
          <Text style={[styles.seeAllText, { color: colors.mutedForeground }]}>See all</Text>
        </PressableScale>
      )}
    </View>
  );
});

const GAP = 12;
/** Space does the separating, so sections get plenty of it. */
const SECTION_GAP = 40;

const defaultKeyOf = (item: { id?: string }, index: number) => item?.id || String(index);

/**
 * A titled sideways row of same-width cards that scrolls freely. The fixed width lets the list
 * skip measuring. It mounts about a screenful, plus two screens either side.
 */
export function CardRow<T>({
  title,
  data,
  itemWidth,
  renderCard,
  keyOf = defaultKeyOf as (item: T, index: number) => string,
}: {
  title?: string;
  data: T[];
  itemWidth: number;
  renderCard: (item: T) => ReactElement | null;
  keyOf?: (item: T, index: number) => string;
}) {
  const step = itemWidth + GAP;
  const renderItem = useCallback(
    ({ item }: { item: T }) => <View style={{ width: itemWidth }}>{renderCard(item)}</View>,
    [itemWidth, renderCard]
  );
  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: step, offset: step * index, index }),
    [step]
  );

  if (!data?.length) return null;

  return (
    <View style={styles.section}>
      <SectionTitle title={title} />
      <FlatList
        data={data}
        keyExtractor={keyOf}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContent}
        ItemSeparatorComponent={RowGap}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        // Android's default clips rows out and redraws them, which flashes blank on a fast flick.
        removeClippedSubviews={false}
      />
    </View>
  );
}

const RowGap = () => <View style={styles.gap} />;

const styles = StyleSheet.create({
  section: { marginBottom: SECTION_GAP },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  title: { fontFamily: fonts.displaySemibold, fontSize: 18, letterSpacing: -0.3 },
  seeAll: { paddingVertical: 2 },
  seeAllText: { fontSize: 13, fontWeight: '600' },
  rowContent: { paddingHorizontal: 16 },
  gap: { width: GAP },
});
