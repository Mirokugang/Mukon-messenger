import React from 'react';
import { View, FlatList, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { List, FAB, Searchbar, Avatar, Badge, Text, Button, Menu } from 'react-native-paper';
import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { theme } from '../theme';
import { truncateAddress, getChatHash } from '../utils/encryption';
import { useWallet } from '../contexts/WalletContext';
import { useMessenger } from '../contexts/MessengerContext';

export default function ContactsScreen({ navigation }: any) {
  const wallet = useWallet();
  const messenger = useMessenger();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [registering, setRegistering] = React.useState(false);
  const [menuVisible, setMenuVisible] = React.useState<string | null>(null);

  // Register user if not already registered
  const handleRegister = async () => {
    setRegistering(true);
    try {
      await messenger.register(''); // Empty display name for now
      Alert.alert('Success', 'Registration complete! You can now add contacts.');
      await messenger.loadProfile();
    } catch (error: any) {
      console.error('Registration failed:', error);
      Alert.alert('Error', 'Registration failed. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  // Show registration screen if not registered
  if (messenger.profile === null && !messenger.loading && wallet.connected) {
    return (
      <View style={styles.registrationContainer}>
        <Avatar.Icon
          size={120}
          icon="account-plus"
          style={styles.registrationIcon}
        />
        <Text style={styles.registrationTitle}>Welcome to Mukon!</Text>
        <Text style={styles.registrationText}>
          Register to start adding contacts and sending encrypted messages.
        </Text>
        <Button
          mode="contained"
          onPress={handleRegister}
          loading={registering}
          disabled={registering}
          style={styles.registrationButton}
          buttonColor={theme.colors.primary}
        >
          Register Now
        </Button>
      </View>
    );
  }

  const contacts = messenger.contacts.map((contact, index) => {
    // Calculate conversation ID for this contact
    const conversationId = wallet.publicKey
      ? Buffer.from(getChatHash(wallet.publicKey, contact.publicKey)).toString('hex')
      : '';

    // Get unread count for this conversation
    const unread = messenger.unreadCounts.get(conversationId) || 0;

    // Get last message from this conversation
    const conversationMessages = messenger.messages.get(conversationId) || [];
    const lastMessage = conversationMessages.length > 0
      ? conversationMessages[conversationMessages.length - 1]
      : null;

    // Decrypt last message if encrypted
    let lastMessageText = '';
    if (lastMessage) {
      const isMe = lastMessage.sender === wallet.publicKey?.toBase58();

      // If it's our message OR it has plaintext content, use that
      if (lastMessage.content) {
        lastMessageText = lastMessage.content;
      } else if (lastMessage.encrypted && lastMessage.nonce) {
        // Decrypt any encrypted message (both incoming and our own)
        try {
          const senderPubkey = new PublicKey(lastMessage.sender);
          const recipientPubkey = item.publicKey; // The contact is the other person
          const decrypted = messenger.decryptConversationMessage(
            lastMessage.encrypted,
            lastMessage.nonce,
            senderPubkey,
            recipientPubkey
          );
          lastMessageText = decrypted || '[Encrypted]';
        } catch (error) {
          lastMessageText = '[Encrypted]';
        }
      } else {
        lastMessageText = '[Encrypted]';
      }
    }

    return {
      id: contact.publicKey.toBase58(),
      displayName: contact.displayName,
      pubkey: contact.publicKey.toBase58(),
      state: contact.state, // Invited, Requested, Accepted, Rejected
      lastMessage: lastMessageText,
      timestamp: lastMessage ? new Date(lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      unread,
      avatar: contact.avatarUrl,
    };
  });

  const renderContact = ({ item }: any) => {
    // Show different UI based on peer state
    if (item.state === 'Requested') {
      // They invited you - show Accept/Decline buttons
      return (
        <List.Item
          title={item.displayName || truncateAddress(item.pubkey, 4)}
          description="Wants to connect with you"
          left={(props) => (
            <Avatar.Text
              {...props}
              size={48}
              label={item.displayName ? item.displayName[0].toUpperCase() : '?'}
              style={{ backgroundColor: theme.colors.accent }}
            />
          )}
          right={() => (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                mode="contained"
                onPress={async () => {
                  try {
                    await messenger.acceptInvitation(new PublicKey(item.pubkey));
                    Alert.alert('Success', 'Invitation accepted!');
                  } catch (error: any) {
                    Alert.alert('Error', error.message);
                  }
                }}
                style={{ backgroundColor: theme.colors.secondary }}
              >
                Accept
              </Button>
              <Button
                mode="outlined"
                onPress={async () => {
                  try {
                    await messenger.rejectInvitation(new PublicKey(item.pubkey));
                    Alert.alert('Declined', 'Invitation declined');
                  } catch (error: any) {
                    Alert.alert('Error', error.message);
                  }
                }}
              >
                Decline
              </Button>
            </View>
          )}
          style={styles.contactItem}
        />
      );
    }

    if (item.state === 'Invited') {
      // You invited them - show pending
      return (
        <List.Item
          title={item.displayName || truncateAddress(item.pubkey, 4)}
          description="Invitation pending..."
          left={(props) => (
            <Avatar.Text
              {...props}
              size={48}
              label={item.displayName ? item.displayName[0].toUpperCase() : '?'}
              style={{ backgroundColor: theme.colors.textSecondary }}
            />
          )}
          right={() => <Text style={{ color: theme.colors.textSecondary }}>Pending</Text>}
          style={styles.contactItem}
        />
      );
    }

    // Blocked contact - show unblock option
    if (item.state === 'Blocked') {
      return (
        <List.Item
          title={item.displayName || truncateAddress(item.pubkey, 4)}
          description="Blocked"
          left={(props) => (
            <Avatar.Text
              {...props}
              size={48}
              label={item.displayName ? item.displayName[0].toUpperCase() : '?'}
              style={{ backgroundColor: '#888' }}
            />
          )}
          right={() => (
            <Button
              mode="outlined"
              onPress={async () => {
                Alert.alert(
                  'Unblock Contact',
                  `Unblock ${item.displayName || truncateAddress(item.pubkey, 4)}?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Unblock',
                      onPress: async () => {
                        try {
                          await messenger.unblockContact(new PublicKey(item.pubkey));
                          Alert.alert('Unblocked', 'Contact unblocked. You can now accept invitations from them.');
                        } catch (error: any) {
                          Alert.alert('Error', error.message);
                        }
                      },
                    },
                  ]
                );
              }}
            >
              Unblock
            </Button>
          )}
          style={styles.contactItem}
        />
      );
    }

    // Accepted - normal contact with long-press menu
    return (
      <Menu
        visible={menuVisible === item.id}
        onDismiss={() => setMenuVisible(null)}
        anchor={
          <TouchableOpacity
            onPress={() => navigation.navigate('Chat', { contact: item })}
            onLongPress={() => setMenuVisible(item.id)}
          >
            <List.Item
              title={item.displayName || truncateAddress(item.pubkey, 4)}
              description={item.lastMessage}
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
                  <Text style={styles.timestamp}>{item.timestamp}</Text>
                  {item.unread > 0 && (
                    <Badge style={styles.badge}>{item.unread}</Badge>
                  )}
                </View>
              )}
              style={styles.contactItem}
            />
          </TouchableOpacity>
        }
      >
        <Menu.Item
          onPress={async () => {
            setMenuVisible(null);
            Alert.alert(
              'Delete Contact',
              `Remove ${item.displayName || truncateAddress(item.pubkey, 4)} from your contacts? You can re-add them later.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await messenger.rejectInvitation(new PublicKey(item.pubkey));
                      Alert.alert('Deleted', 'Contact removed');
                    } catch (error: any) {
                      Alert.alert('Error', error.message);
                    }
                  },
                },
              ]
            );
          }}
          title="Delete Contact"
        />
        <Menu.Item
          onPress={async () => {
            setMenuVisible(null);
            Alert.alert(
              'Block Contact',
              `Block ${item.displayName || truncateAddress(item.pubkey, 4)}? They won't be able to contact you until unblocked.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Block',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await messenger.blockContact(new PublicKey(item.pubkey));
                      Alert.alert('Blocked', 'Contact blocked. You can unblock them later.');
                    } catch (error: any) {
                      Alert.alert('Error', error.message);
                    }
                  },
                },
              ]
            );
          }}
          title="Block Contact"
        />
      </Menu>
    );
  };

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
  rightTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  registrationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: theme.colors.background,
  },
  registrationIcon: {
    backgroundColor: theme.colors.primary,
    marginBottom: 24,
  },
  registrationTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  registrationText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  registrationButton: {
    width: '100%',
    maxWidth: 300,
  },
});
