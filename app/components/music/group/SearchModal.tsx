import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
  TextInput,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import SwipeableModal from '@/components/common/SwipeableModal';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/context/ThemeContext';
import { Song } from '@/types/song';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isSearchLoading: boolean;
  searchResults: Song[];
  onSelectSong: (song: Song) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  isSearchLoading,
  searchResults,
  onSelectSong,
}) => {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <SwipeableModal
      isVisible={isOpen}
      onClose={onClose}
      maxHeight={Dimensions.get('screen').height}
      scrollable={true}
      hideHandle={true}
      style={{
        height: Dimensions.get('screen').height,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
      }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flex: 1, padding: 20, paddingTop: 10 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <TouchableOpacity onPress={onClose} style={{ paddingRight: 16 }}>
              <Ionicons name='arrow-back' size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Input
              ref={inputRef}
              placeholder='Search for songs...'
              value={searchQuery}
              onChangeText={onSearchChange}
              variant='outline'
              containerStyle={{ flex: 1 }}
              leftIcon={<Feather name='search' size={18} color={colors.mutedForeground} />}
              rightIcon={
                searchQuery ? (
                  <TouchableOpacity onPress={() => onSearchChange('')}>
                    <Feather name='x' size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ) : null
              }
            />
          </View>

          {isSearchLoading ? (
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 200,
              }}
            >
              <ActivityIndicator size='large' color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    onSelectSong(item);
                    onClose();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Image
                    source={{
                      uri: item.image?.[1]?.link || 'https://via.placeholder.com/50',
                    }}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 8,
                      backgroundColor: colors.secondary,
                    }}
                  />
                  <View style={{ marginLeft: 16, flex: 1 }}>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontWeight: '500',
                        fontSize: 15,
                      }}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontSize: 13,
                        marginTop: 4,
                      }}
                      numberOfLines={1}
                    >
                      {item.artist_map?.primary_artists?.[0]?.name || 'Unknown Artist'}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: colors.secondary,
                      height: 36,
                      width: 36,
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 8,
                    }}
                  >
                    <Feather name='plus' size={20} color={colors.foreground} />
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                searchQuery ? (
                  <View
                    style={{
                      paddingVertical: 40,
                      alignItems: 'center',
                    }}
                  >
                    <Feather name='search' size={40} color={colors.mutedForeground} />
                    <Text
                      style={{
                        color: colors.foreground,
                        fontWeight: '500',
                        marginTop: 16,
                        fontSize: 16,
                      }}
                    >
                      No results found
                    </Text>
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontSize: 14,
                        marginTop: 4,
                        textAlign: 'center',
                      }}
                    >
                      Try a different search term
                    </Text>
                  </View>
                ) : (
                  <View
                    style={{
                      paddingVertical: 40,
                      alignItems: 'center',
                    }}
                  >
                    <Feather name='music' size={40} color={colors.mutedForeground} />
                    <Text
                      style={{
                        color: colors.foreground,
                        fontWeight: '500',
                        marginTop: 16,
                        fontSize: 16,
                      }}
                    >
                      Search for music
                    </Text>
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontSize: 14,
                        marginTop: 4,
                        textAlign: 'center',
                      }}
                    >
                      Find songs to play in your group
                    </Text>
                  </View>
                )
              }
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </SafeAreaView>
    </SwipeableModal>
  );
};
