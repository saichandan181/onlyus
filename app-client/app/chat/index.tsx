import { ChatScreenContent } from '@/components/chat/ChatScreenContent';
import { useLocalSearchParams } from 'expo-router';

/**
 * Full-screen chat (outside tab navigator). Native swipe-back from the left edge on iOS.
 */
export default function ChatRoute() {
  const { quick } = useLocalSearchParams<{ quick?: string }>();
  return <ChatScreenContent initialQuickAction={quick ?? null} />;
}
