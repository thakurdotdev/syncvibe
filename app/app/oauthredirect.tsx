import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function OAuthRedirectHandler() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the main page after handling the OAuth redirect
    const timer = setTimeout(() => {
      router.replace('/');
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <LinearGradient
        colors={['#000000', '#121212', '#1A1A1A']}
        style={{ position: 'absolute', width: '100%', height: '100%' }}
      />
      <ActivityIndicator size='large' color='#ffffff' />
      <Text style={{ color: '#ffffff', marginTop: 20 }}>Completing authentication...</Text>
    </View>
  );
}
