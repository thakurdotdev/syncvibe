import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import Button from './ui/button';
import Card from './ui/card';

const CardDemo: React.FC = () => {
  const { colors, theme, toggleTheme } = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Card Examples</Text>
        <Button
          variant='outline'
          size='sm'
          title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          icon={
            <Feather name={theme === 'dark' ? 'sun' : 'moon'} size={14} color={colors.primary} />
          }
          iconPosition='left'
          onPress={toggleTheme}
        />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Default Card</Text>

      <Card>
        <Card.Header>
          <Card.Title>Default Card</Card.Title>
          <Card.Description>This is a standard card with a border.</Card.Description>
        </Card.Header>
        <Card.Content>
          <Text style={{ color: colors.foreground }}>
            Cards are containers for content and actions related to a single subject. They can
            contain text, images, and interactive elements.
          </Text>
        </Card.Content>
        <Card.Footer>
          <Button variant='outline' title='Cancel' />
          <Button title='Submit' />
        </Card.Footer>
      </Card>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Card Variants</Text>

      <Card variant='outline' style={styles.cardSpacing}>
        <Card.Header>
          <Card.Title>Outline Card</Card.Title>
          <Card.Description>A card with just a border.</Card.Description>
        </Card.Header>
        <Card.Content>
          <Text style={{ color: colors.foreground }}>
            Outline cards are useful when you want a more subtle container.
          </Text>
        </Card.Content>
      </Card>

      <Card variant='secondary' style={styles.cardSpacing}>
        <Card.Header>
          <Card.Title>Secondary Card</Card.Title>
          <Card.Description>Uses secondary background color.</Card.Description>
        </Card.Header>
        <Card.Content>
          <Text style={{ color: colors.secondaryForeground }}>
            Secondary cards can be used to differentiate sections.
          </Text>
        </Card.Content>
      </Card>

      <Card variant='ghost' style={styles.cardSpacing}>
        <Card.Header>
          <Card.Title>Ghost Card</Card.Title>
          <Card.Description>No visible container.</Card.Description>
        </Card.Header>
        <Card.Content>
          <Text style={{ color: colors.foreground }}>
            Ghost cards are completely transparent, useful for nested content.
          </Text>
        </Card.Content>
      </Card>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Interactive Cards</Text>

      <View style={styles.cardRow}>
        <Card style={styles.halfCard}>
          <Card.Action onPress={() => console.log('Card pressed')}>
            <Card.Header>
              <Card.Title>Clickable Card</Card.Title>
              <Card.Description>Tap this entire card</Card.Description>
            </Card.Header>
            <Card.Content>
              <Text style={{ color: colors.foreground }}>
                This whole card is clickable as one unit.
              </Text>
            </Card.Content>
          </Card.Action>
        </Card>

        <Card style={styles.halfCard}>
          <Card.Header>
            <Card.Title>Button Card</Card.Title>
            <Card.Description>With action buttons</Card.Description>
          </Card.Header>
          <Card.Content>
            <Text style={{ color: colors.foreground }}>
              This card has interactive button elements.
            </Text>
          </Card.Content>
          <Card.Footer>
            <Button
              variant='ghost'
              size='sm'
              icon={<Feather name='heart' size={14} color={colors.primary} />}
              iconPosition='left'
              title='Like'
            />
            <Button
              variant='ghost'
              size='sm'
              icon={<Feather name='share' size={14} color={colors.primary} />}
              iconPosition='left'
              title='Share'
            />
          </Card.Footer>
        </Card>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Card with Icons</Text>

      <Card style={styles.cardSpacing}>
        <Card.Header>
          <View style={styles.iconHeader}>
            <Feather name='bell' size={20} color={colors.primary} />
            <Card.Title style={styles.iconTitle}>Notification Card</Card.Title>
          </View>
          <Card.Description>An important notification</Card.Description>
        </Card.Header>
        <Card.Content>
          <Text style={{ color: colors.foreground }}>
            Cards can include icons to provide visual cues about content.
          </Text>
        </Card.Content>
        <Card.Footer>
          <Button
            variant='ghost'
            title='Dismiss'
            icon={<Feather name='x' size={14} color={colors.primary} />}
            iconPosition='left'
          />
          <Button
            title='Take Action'
            icon={<Feather name='arrow-right' size={14} color={colors.primaryForeground} />}
            iconPosition='right'
          />
        </Card.Footer>
      </Card>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Complex Example</Text>

      <Card style={styles.cardSpacing}>
        <Card.Header>
          <Card.Title>Music Player</Card.Title>
          <Card.Description>Now Playing</Card.Description>
        </Card.Header>
        <Card.Content>
          <View style={styles.albumInfo}>
            <View style={[styles.albumCover, { backgroundColor: colors.muted }]}>
              <Feather name='music' size={24} color={colors.mutedForeground} />
            </View>
            <View style={styles.songInfo}>
              <Text style={[styles.songTitle, { color: colors.foreground }]}>Song Title</Text>
              <Text style={[styles.artistName, { color: colors.mutedForeground }]}>
                Artist Name
              </Text>
              <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                <View
                  style={[styles.progressFill, { backgroundColor: colors.primary, width: '60%' }]}
                />
              </View>
              <Text style={[styles.time, { color: colors.mutedForeground }]}>2:34 / 4:15</Text>
            </View>
          </View>
        </Card.Content>
        <Card.Footer>
          <View style={styles.playerControls}>
            <Button
              variant='ghost'
              size='icon'
              icon={<Feather name='skip-back' size={18} color={colors.primary} />}
            />
            <Button
              size='icon'
              icon={<Feather name='pause' size={18} color={colors.primaryForeground} />}
            />
            <Button
              variant='ghost'
              size='icon'
              icon={<Feather name='skip-forward' size={18} color={colors.primary} />}
            />
          </View>
        </Card.Footer>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
  },
  cardSpacing: {
    marginBottom: 16,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  halfCard: {
    flex: 1,
  },
  iconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  iconTitle: {
    marginLeft: 8,
    marginBottom: 0,
  },
  albumInfo: {
    flexDirection: 'row',
  },
  albumCover: {
    width: 80,
    height: 80,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  songInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  artistName: {
    fontSize: 14,
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  time: {
    fontSize: 12,
  },
  playerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    gap: 20,
  },
});

export default CardDemo;
