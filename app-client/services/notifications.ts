import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Remote push is not available in Expo Go (SDK 53+). Importing `expo-notifications`
 * runs native registration side effects that throw there, so we only load the module
 * in standalone / dev builds.
 */
function canUseRemotePush(): boolean {
  if (Constants.appOwnership === 'expo') return false;
  if (!Constants.isDevice) return false;
  return true;
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!canUseRemotePush()) {
    return null;
  }

  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId || 'your-project-id';
    const token = await Notifications.getExpoPushTokenAsync({ projectId });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B6B',
      });
    }

    return token.data;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

export async function setupNotificationListeners(
  onNotificationReceived?: (notification: import('expo-notifications').Notification) => void,
  onNotificationResponse?: (response: import('expo-notifications').NotificationResponse) => void
): Promise<() => void> {
  if (!canUseRemotePush()) {
    return () => {};
  }

  const Notifications = await import('expo-notifications');
  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    onNotificationReceived?.(notification);
  });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    onNotificationResponse?.(response);
  });

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
