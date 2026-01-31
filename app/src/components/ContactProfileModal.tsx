import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Portal, Dialog, Text, IconButton, Divider, Button } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../theme';

interface ContactProfileModalProps {
  visible: boolean;
  onDismiss: () => void;
  pubkey: string;
  displayName: string;
  avatar?: string;
  walletAddress: string;
  isContact: boolean;
  onDeleteContact?: () => void;
  onBlockContact?: () => void;
}

export default function ContactProfileModal({
  visible,
  onDismiss,
  pubkey,
  displayName,
  avatar,
  walletAddress,
  isContact,
  onDeleteContact,
  onBlockContact,
}: ContactProfileModalProps) {
  const handleCopyAddress = async () => {
    await Clipboard.setStringAsync(walletAddress);
    // TODO: Show toast/snackbar
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Content style={styles.content}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            {avatar && Array.from(avatar).length === 1 ? (
              <Text style={styles.avatarEmoji}>{avatar}</Text>
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>
                  {displayName[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>

          {/* Display Name */}
          <Text style={styles.displayName}>{displayName}</Text>

          {/* Wallet Address with Copy Button */}
          <View style={styles.addressRow}>
            <Text style={styles.address} numberOfLines={1} ellipsizeMode="middle">
              {walletAddress}
            </Text>
            <IconButton
              icon="content-copy"
              size={16}
              iconColor={theme.colors.textSecondary}
              onPress={handleCopyAddress}
            />
          </View>

          <Divider style={styles.divider} />

          {/* Send Crypto Button (Disabled - Coming Soon) */}
          <Button
            mode="outlined"
            disabled
            style={styles.actionButton}
            contentStyle={styles.actionButtonContent}
            labelStyle={styles.disabledButtonLabel}
          >
            Send Crypto (Coming Soon)
          </Button>

          <Divider style={styles.divider} />

          {/* Delete Contact */}
          {isContact && onDeleteContact && (
            <Button
              mode="text"
              onPress={() => {
                onDismiss();
                onDeleteContact();
              }}
              style={styles.actionButton}
              labelStyle={styles.destructiveButtonLabel}
            >
              Delete Contact
            </Button>
          )}

          {/* Block Contact */}
          {isContact && onBlockContact && (
            <Button
              mode="text"
              onPress={() => {
                onDismiss();
                onBlockContact();
              }}
              style={styles.actionButton}
              labelStyle={styles.destructiveButtonLabel}
            >
              Block Contact
            </Button>
          )}

          <Divider style={styles.divider} />

          {/* Close Button */}
          <Button
            mode="contained"
            onPress={onDismiss}
            style={styles.closeButton}
            buttonColor={theme.colors.primary}
          >
            Close
          </Button>
        </Dialog.Content>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    backgroundColor: theme.colors.surface,
  },
  content: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatarEmoji: {
    fontSize: 96,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    fontSize: 48,
    fontWeight: '600',
    color: theme.colors.onPrimary,
  },
  displayName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    marginBottom: 16,
  },
  address: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: theme.colors.textSecondary,
    flex: 1,
  },
  divider: {
    width: '100%',
    marginVertical: 8,
    backgroundColor: theme.colors.background,
  },
  actionButton: {
    width: '100%',
    marginVertical: 4,
  },
  actionButtonContent: {
    paddingVertical: 4,
  },
  disabledButtonLabel: {
    color: theme.colors.textSecondary,
  },
  destructiveButtonLabel: {
    color: theme.colors.error,
  },
  closeButton: {
    width: '100%',
    marginTop: 8,
  },
});
