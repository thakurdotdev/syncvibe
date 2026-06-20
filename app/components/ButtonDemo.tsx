import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons'; // Using Expo Vector Icons
import { useTheme } from '@/context/ThemeContext'; // Assuming you have a ThemeContext
import Button from '../components/ui/button';

const ButtonsDemo: React.FC = () => {
  const { colors, theme, toggleTheme } = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Button Examples</Text>
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

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Variants</Text>

      <View style={styles.section}>
        <Button title='Default' />
        <Button variant='secondary' title='Secondary' />
        <Button variant='destructive' title='Destructive' />
        <Button variant='outline' title='Outline' />
        <Button variant='ghost' title='Ghost' />
        <Button variant='link' title='Link' />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Sizes</Text>

      <View style={styles.section}>
        <Button size='sm' title='Small' />
        <Button size='default' title='Default' />
        <Button size='lg' title='Large' />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>With Icons</Text>

      <View style={styles.section}>
        <Button
          icon={<Feather name='download' size={14} color='white' />}
          iconPosition='left'
          title='Download'
        />

        <Button
          variant='secondary'
          icon={<Feather name='arrow-right' size={14} color={colors.secondaryForeground} />}
          iconPosition='right'
          title='Next'
        />

        <Button
          variant='outline'
          icon={<Feather name='settings' size={14} color={colors.primary} />}
          iconPosition='left'
          title='Settings'
        />

        <View style={styles.iconRow}>
          <Button
            variant='outline'
            size='icon'
            icon={<Feather name='plus' size={16} color={colors.primary} />}
          />

          <Button
            size='icon'
            icon={<Feather name='check' size={16} color={colors.primaryForeground} />}
          />

          <Button
            variant='destructive'
            size='icon'
            icon={<Feather name='trash-2' size={16} color={colors.destructiveForeground} />}
          />
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>States</Text>

      <View style={styles.section}>
        <Button isLoading title='Loading' />

        <Button disabled title='Disabled' />

        <Button variant='outline' disabled title='Disabled Outline' />

        <Button variant='secondary' disabled title='Disabled Secondary' />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Examples</Text>

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Create a new project</Text>
        <Text style={[styles.cardDescription, { color: colors.mutedForeground }]}>
          Deploy your new project in one-click.
        </Text>
        <View style={styles.cardActions}>
          <Button variant='outline' title='Cancel' style={{ flex: 1 }} />
          <Button title='Deploy' style={{ flex: 1 }} />
        </View>
      </View>
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
  section: {
    gap: 12,
  },
  iconRow: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
});

export default ButtonsDemo;
