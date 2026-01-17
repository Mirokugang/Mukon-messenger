import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text, IconButton } from 'react-native-paper';
import { theme } from '../theme';

export default function AddContactScreen({ navigation }: any) {
  const [address, setAddress] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const sendInvitation = async () => {
    if (!address.trim()) return;

    setLoading(true);
    try {
      // TODO: Use useMukonMessenger hook to send invitation
      console.log('Sending invitation to:', address);

      // Navigate back on success
      navigation.goBack();
    } catch (error) {
      console.error('Failed to send invitation:', error);
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
