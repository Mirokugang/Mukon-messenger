import React from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Text, Avatar, List } from 'react-native-paper';
import { theme } from '../theme';
import { truncateAddress } from '../utils/encryption';
import { useWallet } from '../contexts/WalletContext';

export default function ProfileScreen() {
  const { publicKey, disconnect } = useWallet();
  const [displayName, setDisplayName] = React.useState('');
  const [editing, setEditing] = React.useState(false);

  const saveProfile = async () => {
    // TODO: Use useMukonMessenger hook to update profile
    console.log('Updating profile');
    setEditing(false);
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Wallet',
      'Are you sure you want to disconnect your wallet?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await disconnect();
          },
        },
      ]
    );
  };

  const walletAddress = publicKey?.toBase58() || '';

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Avatar.Text
          size={96}
          label={displayName ? displayName[0].toUpperCase() : walletAddress ? walletAddress[0].toUpperCase() : '?'}
          style={styles.avatar}
        />
        {editing ? (
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            mode="outlined"
            placeholder="Display name (optional)"
            style={styles.nameInput}
            outlineColor={theme.colors.surface}
            activeOutlineColor={theme.colors.primary}
          />
        ) : displayName ? (
          <Text style={styles.name}>{displayName}</Text>
        ) : null}
        <Text style={styles.pubkey}>{truncateAddress(walletAddress, 6)}</Text>
      </View>

      <List.Section style={styles.section}>
        <List.Subheader style={styles.subheader}>Wallet</List.Subheader>
        <List.Item
          title="Address"
          description={walletAddress}
          left={(props) => <List.Icon {...props} icon="wallet" />}
          style={styles.listItem}
        />
      </List.Section>

      <List.Section style={styles.section}>
        <List.Subheader style={styles.subheader}>Privacy</List.Subheader>
        <List.Item
          title="End-to-End Encryption"
          description="All messages are encrypted"
          left={(props) => <List.Icon {...props} icon="lock" color={theme.colors.secondary} />}
          style={styles.listItem}
        />
        <List.Item
          title="On-Chain Contacts"
          description="Contact list encrypted via Arcium"
          left={(props) => <List.Icon {...props} icon="shield-check" color={theme.colors.secondary} />}
          style={styles.listItem}
        />
      </List.Section>

      <Button
        mode="contained"
        onPress={editing ? saveProfile : () => setEditing(true)}
        style={styles.button}
        buttonColor={theme.colors.primary}
      >
        {editing ? 'Save Profile' : 'Edit Profile'}
      </Button>

      <Button
        mode="outlined"
        onPress={handleDisconnect}
        style={styles.button}
        textColor={theme.colors.accent}
      >
        Disconnect Wallet
      </Button>

      <Text style={styles.version}>Mukon Messenger v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    alignItems: 'center',
    padding: 24,
  },
  avatar: {
    backgroundColor: theme.colors.primary,
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  nameInput: {
    width: 200,
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
  },
  pubkey: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  section: {
    marginTop: 16,
  },
  subheader: {
    color: theme.colors.textSecondary,
  },
  listItem: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 16,
    marginVertical: 2,
    borderRadius: 8,
  },
  button: {
    margin: 16,
  },
  version: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginVertical: 24,
  },
});
