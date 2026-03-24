import { Redirect, type Href } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/authStore';

export default function Index() {
  const { isLoading, isAuthenticated, isPaired } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (isPaired) {
    return <Redirect href={'/(tabs)/us' as Href} />;
  }

  return <Redirect href="/(onboarding)/pairing" />;
}
