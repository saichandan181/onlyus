import { Stack } from 'expo-router';

/**
 * Stack options for /chat — file-based route only (no duplicate Stack.Screen in root).
 */
export default function ChatStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'card',
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    />
  );
}
