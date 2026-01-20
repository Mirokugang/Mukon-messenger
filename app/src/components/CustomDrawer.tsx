import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { Avatar, Text, Divider, List } from 'react-native-paper';
import { theme } from '../theme';
import { useWallet } from '../contexts/WalletContext';
import { truncateAddress } from '../utils/encryption';

export default function CustomDrawer({ navigation }: any) {
  const wallet = useWallet();

  return (
    <DrawerContentScrollView style={styles.container}>
      {/* Profile Section */}
      <TouchableOpacity
        style={styles.profileSection}
        onPress={() => navigation.navigate('Profile')}
      >
        <Avatar.Icon
          size={64}
          icon="account-circle"
          style={styles.avatar}
        />
        <Text style={styles.walletAddress}>
          {wallet.publicKey ? truncateAddress(wallet.publicKey.toBase58(), 6) : 'Not connected'}
        </Text>
      </TouchableOpacity>

      <Divider style={styles.divider} />

      {/* Navigation Items */}
      <List.Item
        title="Chats"
        left={(props) => <List.Icon {...props} icon="message-text" color={theme.colors.primary} />}
        onPress={() => navigation.navigate('Contacts')}
        titleStyle={styles.menuItem}
      />

      <List.Item
        title="Contacts"
        left={(props) => <List.Icon {...props} icon="account-multiple" color={theme.colors.primary} />}
        onPress={() => navigation.navigate('Contacts')}
        titleStyle={styles.menuItem}
      />

      <List.Item
        title="Saved Messages"
        left={(props) => <List.Icon {...props} icon="bookmark" color={theme.colors.primary} />}
        onPress={() => {
          // TODO: Navigate to saved messages
          navigation.closeDrawer();
        }}
        titleStyle={styles.menuItem}
      />

      <Divider style={styles.divider} />

      <List.Item
        title="Settings"
        left={(props) => <List.Icon {...props} icon="cog" color={theme.colors.textSecondary} />}
        onPress={() => {
          // TODO: Navigate to settings
          navigation.closeDrawer();
        }}
        titleStyle={styles.menuItem}
      />

      <List.Item
        title="Invite Friends"
        left={(props) => <List.Icon {...props} icon="account-plus" color={theme.colors.textSecondary} />}
        onPress={() => {
          // TODO: Share invite link
          navigation.closeDrawer();
        }}
        titleStyle={styles.menuItem}
      />
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
  },
  profileSection: {
    padding: 24,
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: theme.colors.primary,
    marginBottom: 12,
  },
  walletAddress: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  divider: {
    backgroundColor: theme.colors.surface,
    marginVertical: 8,
  },
  menuItem: {
    color: theme.colors.textPrimary,
    fontSize: 16,
  },
});
