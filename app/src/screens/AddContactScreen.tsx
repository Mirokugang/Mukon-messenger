import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { TextInput, Button, Text, IconButton } from 'react-native-paper';
import { PublicKey } from '@solana/web3.js';
import { theme } from '../theme';
import { useWallet } from '../contexts/WalletContext';
import { useMessenger } from '../contexts/MessengerContext';

export default function AddContactScreen({ navigation }: any) {
  const wallet = useWallet();
  const messenger = useMessenger();
  const [address, setAddress] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const sendInvitation = async () => {
    if (!address.trim()) return;

    setLoading(true);
    try {
      // Validate and parse the address
      const contactPubkey = new PublicKey(address.trim());

      // Send invitation on-chain
      const tx = await messenger.invite(contactPubkey);

      Alert.alert(
        'Invitation Sent!',
        `Invitation sent to ${address.slice(0, 8)}...\n\nTransaction: ${tx.slice(0, 8)}...`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Refresh contacts and navigate back
              messenger.loadContacts();
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Failed to send invitation:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to send invitation. Please check the address and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Enter wallet address or .sol</Text>
      <TextInput
        value={address}
        onChangeText={setAddress}
        placeholder="7xKp..."
        mode="outlined"
        style={styles.input}
        outlineColor={theme.colors.surface}
        activeOutlineColor={theme.colors.primary}
        placeholderTextColor={theme.colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>Or scan QR code</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.qrContainer}>
        <IconButton
          icon="qrcode-scan"
          size={64}
          iconColor={theme.colors.textSecondary}
          onPress={() => {
            // TODO: Implement QR scanner
            console.log('Open QR scanner');
          }}
        />
        <Text style={styles.qrText}>Camera</Text>
      </View>

      <Button
        mode="contained"
        onPress={sendInvitation}
        loading={loading}
        disabled={!address.trim() || loading}
        style={styles.button}
        buttonColor={theme.colors.primary}
      >
        Send Invitation
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: theme.colors.background,
  },
  label: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.surface,
    marginBottom: 24,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.surface,
  },
  dividerText: {
    marginHorizontal: 16,
    color: theme.colors.textSecondary,
  },
  qrContainer: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    marginBottom: 24,
  },
  qrText: {
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
  button: {
    marginTop: 'auto',
  },
});
