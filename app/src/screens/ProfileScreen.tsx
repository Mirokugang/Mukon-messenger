import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text, Avatar, List } from 'react-native-paper';
import { theme } from '../theme';
import { truncateAddress } from '../utils/encryption';

export default function ProfileScreen() {
  const [displayName, setDisplayName] = React.useState('Alice');
  const [avatarUrl, setAvatarUrl] = React.useState('');
  const [editing, setEditing] = React.useState(false);

  // Mock wallet - replace with actual wallet from useMukonMessenger
  const wallet = {
    publicKey: '7xKpRmN...3mNqWt',
    balance: '1.234 SOL',
  };

  const saveProfile = async () => {
    // TODO: Use useMukonMessenger hook to update profile
    console.log('Updating profile');
    setEditing(false);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Avatar.Text
          size={96}
          label={displayName[0].toUpperCase()}
          style={styles.avatar}
        />
        {editing ? (
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            mode="outlined"
            style={styles.nameInput}
            outlineColor={theme.colors.surface}
            activeOutlineColor={theme.colors.primary}
          />
        ) : (
          <Text style={styles.name}>{displayName}</Text>
        )}
        <Text style={styles.pubkey}>{truncateAddress(wallet.publicKey, 6)}</Text>
      </View>

      <List.Section style={styles.section}>
        <List.Subheader style={styles.subheader}>Wallet</List.Subheader>
        <List.Item
          title="Address"
          description={wallet.publicKey}
          left={(props) => <List.Icon {...props} icon="wallet" />}
          style={styles.listItem}
        />
        <List.Item
          title="Balance"
          description={wallet.balance}
          left={(props) => <List.Icon {...props} icon="currency-usd" />}
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
