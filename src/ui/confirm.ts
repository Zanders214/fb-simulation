import { Alert, Platform } from 'react-native';

/**
 * Cross-platform confirmation dialog.
 *
 * `Alert.alert` is a no-op on react-native-web, which silently swallowed every
 * destructive confirmation (delete save, new game, advance season). On web we
 * fall back to the synchronous browser `confirm`; on native we use `Alert`.
 */
export function confirmAction({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
}: Readonly<{
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}>): void {
  if (Platform.OS === 'web') {
    const body = message ? `${title}\n\n${message}` : title;
    const ok = typeof globalThis.confirm === 'function' ? globalThis.confirm(body) : true;
    if (ok) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
