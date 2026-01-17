import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { List, FAB, Searchbar, Avatar, Badge } from 'react-native-paper';
import { theme } from '../theme';
import { truncateAddress } from '../utils/encryption';

export default function ContactsScreen({ navigation }: any) {
  const [searchQuery, setSearchQuery] = React.useState('');

  // Mock data - replace with actual contacts from useMukonMessenger hook
  const contacts = [
    {
      id: '1',
      displayName: 'Alice',
      pubkey: '7xKpR...3mNq',
      lastMessage: 'Hey, how are you?',
      timestamp: '2m',
      unread: 2,
      avatar: null,
    },
    {
      id: '2',
      displayName: null,
      pubkey: '9zYpL...8kWt',
      lastMessage: 'Sent you an invite',
      timestamp: '1h',
      unread: 0,
      avatar: null,
    },
  ];

  const renderContact = ({ item }: any) => (
    <List.Item
      title={item.displayName || truncateAddress(item.pubkey, 4)}
      description={item.lastMessage}
      onPress={() => navigation.navigate('Chat', { contact: item })}
      left={(props) => (
        <Avatar.Text
          {...props}
          size={48}
          label={item.displayName ? item.displayName[0].toUpperCase() : '?'}
          style={{ backgroundColor: theme.colors.primary }}
        />
      )}
      right={(props) => (
        <View style={styles.rightContainer}>
          <List.Text style={styles.timestamp}>{item.timestamp}</List.Text>
          {item.unread > 0 && (
            <Badge style={styles.badge}>{item.unread}</Badge>
          )}
        </View>
      )}
      style={styles.contactItem}
    />
  );

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search contacts..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
        iconColor={theme.colors.textSecondary}
        placeholderTextColor={theme.colors.textSecondary}
      />
      <FlatList
        data={contacts}
        renderItem={renderContact}
        keyExtractor={(item) => item.id}
        style={styles.list}
      />
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('AddContact')}
        color={theme.colors.onPrimary}
      />
      <FAB
        icon="account"
        style={styles.profileFab}
        onPress={() => navigation.navigate('Profile')}
        color={theme.colors.onPrimary}
        small
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  searchbar: {
    margin: 16,
    backgroundColor: theme.colors.surface,
  },
  list: {
    flex: 1,
  },
  contactItem: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
  },
  rightContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  timestamp: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  badge: {
    backgroundColor: theme.colors.accent,
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: theme.colors.primary,
  },
  profileFab: {
    position: 'absolute',
    right: 16,
    bottom: 88,
    backgroundColor: theme.colors.secondary,
  },
});
