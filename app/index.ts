// Defined before the app itself: when Android starts the app in the background for a
// notification button, this is the only part that runs.
import { registerNotificationActionTask } from './lib/notificationActions';
import 'expo-router/entry';

void registerNotificationActionTask();
