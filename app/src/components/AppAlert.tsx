import React from 'react';
import { StyleSheet } from 'react-native';
import { Portal, Dialog, Text, Button } from 'react-native-paper';
import { theme } from '../theme';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AppAlertProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
  onDismiss: () => void;
}

export default function AppAlert({ visible, title, message, buttons, onDismiss }: AppAlertProps) {
  const handleButtonPress = (button: AlertButton) => {
    onDismiss();
    if (button.onPress) {
      // Delay to allow dialog to close first
      setTimeout(() => button.onPress!(), 100);
    }
  };

  // Separate cancel and action buttons
  const cancelButtons = buttons.filter((b) => b.style === 'cancel');
  const actionButtons = buttons.filter((b) => b.style !== 'cancel');

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title style={styles.title}>{title}</Dialog.Title>
        {message && (
          <Dialog.Content>
            <Text style={styles.message}>{message}</Text>
          </Dialog.Content>
        )}
        <Dialog.Actions>
          {/* Cancel buttons on the left */}
          {cancelButtons.map((button, index) => (
            <Button
              key={`cancel-${index}`}
              onPress={() => handleButtonPress(button)}
              textColor={theme.colors.textSecondary}
            >
              {button.text}
            </Button>
          ))}
          {/* Action buttons on the right */}
          {actionButtons.map((button, index) => (
            <Button
              key={`action-${index}`}
              onPress={() => handleButtonPress(button)}
              textColor={
                button.style === 'destructive'
                  ? theme.colors.error
                  : theme.colors.primary
              }
            >
              {button.text}
            </Button>
          ))}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    backgroundColor: theme.colors.surface,
  },
  title: {
    color: theme.colors.textPrimary,
    fontWeight: 'bold',
  },
  message: {
    color: theme.colors.textSecondary,
  },
});
