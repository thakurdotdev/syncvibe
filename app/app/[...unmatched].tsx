import { useNavigation } from '@react-navigation/native';
import { useLayoutEffect } from 'react';
import { View } from 'react-native';

export default function UnmatchedRoute() {
  const navigation = useNavigation<any>(); // Type casting to avoid TypeScript errors

  // useLayoutEffect runs synchronously after render but before screen updates
  // This should provide a more seamless transition
  useLayoutEffect(() => {
    // For Expo Router, we can use the native navigation API with the correct screen name format
    navigation.reset({
      index: 0,
      routes: [{ name: '(tabs)' }],
    });
  }, [navigation]);

  // Return an invisible view while navigating
  return <View style={{ flex: 1, backgroundColor: 'transparent' }} />;
}
