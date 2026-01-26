import React from 'react';
import { View, FlatList, StyleSheet, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { List, FAB, Searchbar, Avatar, Badge, Text, Button, Menu, Dialog, Portal, TextInput, Chip } from 'react-native-paper';
import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../theme';
import { truncateAddress, getChatHash } from '../utils/encryption';
import { useWallet } from '../contexts/WalletContext';
import { useMessenger } from '../contexts/MessengerContext';
import { useContactNames } from '../hooks/useContactNames';
import { setContactCustomName, getContactCustomName, getCachedDomain } from '../utils/domains';

type FilterType = 'All' | 'DMs' | 'Groups' | 'Unread';

export default function ContactsScreen({ navigation }: any) {
  const wallet = useWallet();
  const messenger = useMessenger();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [registering, setRegistering] = React.useState(false);
  const [menuVisible, setMenuVisible] = React.useState<string | null>(null);
  const [renameDialogVisible, setRenameDialogVisible] = React.useState(false);
  const [renamingContact, setRenamingContact] = React.useState<{ pubkey: string; currentName: string } | null>(null);
  const [newName, setNewName] = React.useState('');
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [filter, setFilter] = React.useState<FilterType>('All');
  const displayNames = useContactNames(messenger.contacts);

  // Refresh display names when screen comes into focus (after editing in ChatScreen)
  useFocusEffect(
    React.useCallback(() => {
      setRefreshKey(prev => prev + 1);
    }, [])
  );

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
          const recipientPubkey = contact.publicKey; // The contact is the other person
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

    // Get display name from hook (custom name > domain > on-chain name > pubkey)
    const pubkeyStr = contact.publicKey.toBase58();
    const displayInfo = displayNames.get(pubkeyStr);
    const displayName = displayInfo?.displayName || contact.displayName || truncateAddress(pubkeyStr, 4);

    return {
      id: pubkeyStr,
      displayName,
      pubkey: pubkeyStr,
      publicKey: contact.publicKey,
      state: contact.state, // Invited, Requested, Accepted, Rejected, Blocked
      lastMessage: lastMessageText,
      timestamp: lastMessage ? new Date(lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      unread,
      avatar: contact.avatarUrl || '', // Emoji avatar if set
    };
  });

  const renderContact = ({ item }: any) => {
    // Handle groups differently
    if (item.type === 'group') {
      return (
        <TouchableOpacity
          onPress={() => navigation.navigate('GroupChat', {
            groupId: item.id,
            groupName: item.displayName,
          })}
        >
          <List.Item
            title={item.displayName}
            description={item.lastMessage || 'Tap to open group'}
            left={(props) => (
              <Avatar.Icon
                {...props}
                size={48}
                icon="account-group"
                style={{ backgroundColor: theme.colors.secondary }}
              />
            )}
            right={(props) => (
              <View style={styles.rightContainer}>
                {item.timestamp && <Text style={styles.timestamp}>{item.timestamp}</Text>}
                {item.unread > 0 && (
                  <Badge style={styles.badge}>{item.unread}</Badge>
                )}
              </View>
            )}
            style={styles.contactItem}
          />
        </TouchableOpacity>
      );
    }

    // Show different UI based on peer state
    if (item.state === 'Requested') {
      // They invited you - show Accept/Decline buttons
      return (
        <List.Item
          title={item.displayName || truncateAddress(item.pubkey, 4)}
          description="Wants to connect with you"
          left={(props) => (
            item.avatar && Array.from(item.avatar).length === 1 ? (
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 32 }}>{item.avatar}</Text>
              </View>
            ) : (
              <Avatar.Text
                {...props}
                size={48}
                label={item.displayName ? item.displayName[0].toUpperCase() : '?'}
                style={{ backgroundColor: theme.colors.accent }}
              />
            )
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
            item.avatar && Array.from(item.avatar).length === 1 ? (
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 32 }}>{item.avatar}</Text>
              </View>
            ) : (
              <Avatar.Text
                {...props}
                size={48}
                label={item.displayName ? item.displayName[0].toUpperCase() : '?'}
                style={{ backgroundColor: theme.colors.textSecondary }}
              />
            )
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
            item.avatar && Array.from(item.avatar).length === 1 ? (
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 32 }}>{item.avatar}</Text>
              </View>
            ) : (
              <Avatar.Text
                {...props}
                size={48}
                label={item.displayName ? item.displayName[0].toUpperCase() : '?'}
                style={{ backgroundColor: '#888' }}
              />
            )
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
                item.avatar && Array.from(item.avatar).length === 1 ? (
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 32 }}>{item.avatar}</Text>
                  </View>
                ) : (
                  <Avatar.Text
                    {...props}
                    size={48}
                    label={item.displayName ? item.displayName[0].toUpperCase() : '?'}
                    style={{ backgroundColor: theme.colors.primary }}
                  />
                )
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
          onPress={() => {
            setMenuVisible(null);
            setRenamingContact({ pubkey: item.pubkey, currentName: item.displayName });
            setNewName('');
            setRenameDialogVisible(true);
          }}
          title="Rename Contact"
          leadingIcon="pencil"
        />
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

  const handleRename = async () => {
    if (!renamingContact) return;

    try {
      const pubkey = new PublicKey(renamingContact.pubkey);
      await setContactCustomName(pubkey, newName);
      setRenameDialogVisible(false);
      setRenamingContact(null);
      setNewName('');

      // Force re-render by updating refresh key
      setRefreshKey(prev => prev + 1);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to rename contact');
    }
  };

  // Combine DMs and Groups into unified list
  const allConversations = [
    ...contacts.map(c => ({ ...c, type: 'dm' as const })),
    ...messenger.groups.map(g => ({
      id: Buffer.from(g.groupId).toString('hex'),
      displayName: g.name,
      pubkey: '',
      type: 'group' as const,
      state: 'Accepted',
      lastMessage: '', // TODO: Get last group message
      timestamp: '',
      unread: 0, // TODO: Track group unread counts
      avatar: '', // TODO: Group emoji avatar
      group: g,
    })),
  ];

  // Apply filter
  const filteredConversations = allConversations.filter(item => {
    if (filter === 'DMs') return item.type === 'dm';
    if (filter === 'Groups') return item.type === 'group';
    if (filter === 'Unread') return item.unread > 0;
    return true; // 'All'
  });

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search conversations..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
        iconColor={theme.colors.textSecondary}
        placeholderTextColor={theme.colors.textSecondary}
      />

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipContainer}
      >
        <Chip
          selected={filter === 'All'}
          onPress={() => setFilter('All')}
          style={styles.chip}
          textStyle={filter === 'All' ? styles.chipTextSelected : styles.chipText}
        >
          All
        </Chip>
        <Chip
          selected={filter === 'DMs'}
          onPress={() => setFilter('DMs')}
          style={styles.chip}
          textStyle={filter === 'DMs' ? styles.chipTextSelected : styles.chipText}
        >
          DMs
        </Chip>
        <Chip
          selected={filter === 'Groups'}
          onPress={() => setFilter('Groups')}
          style={styles.chip}
          textStyle={filter === 'Groups' ? styles.chipTextSelected : styles.chipText}
        >
          Groups
        </Chip>
        <Chip
          selected={filter === 'Unread'}
          onPress={() => setFilter('Unread')}
          style={styles.chip}
          textStyle={filter === 'Unread' ? styles.chipTextSelected : styles.chipText}
        >
          Unread
        </Chip>
      </ScrollView>

      <FlatList
        data={filteredConversations}
        renderItem={renderContact}
        keyExtractor={(item) => item.id}
        style={styles.list}
      />

      {/* Two FABs - Add Contact and Create Group */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('AddContact')}
        color={theme.colors.onPrimary}
        label="Contact"
      />
      <FAB
        icon="account-group"
        style={styles.fabGroup}
        onPress={() => navigation.navigate('CreateGroup')}
        color={theme.colors.onPrimary}
        label="Group"
      />

      {/* Rename Contact Dialog */}
      <Portal>
        <Dialog visible={renameDialogVisible} onDismiss={() => setRenameDialogVisible(false)}>
          <Dialog.Title>Rename Contact</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: theme.colors.textSecondary, marginBottom: 8 }}>
              Current: {renamingContact?.currentName}
            </Text>
            <TextInput
              label="New Name"
              value={newName}
              onChangeText={setNewName}
              mode="outlined"
              placeholder="Enter custom name"
              style={{ backgroundColor: theme.colors.surface }}
              outlineColor={theme.colors.surface}
              activeOutlineColor={theme.colors.primary}
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRenameDialogVisible(false)}>Cancel</Button>
            <Button
              onPress={handleRename}
              mode="contained"
              buttonColor={theme.colors.primary}
              disabled={!newName.trim()}
            >
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
  },
  chipContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    marginRight: 8,
  },
  chipText: {
    color: theme.colors.textSecondary,
  },
  chipTextSelected: {
    color: theme.colors.primary,
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
    bottom: 88, // Stack above group FAB
    backgroundColor: theme.colors.primary,
  },
  fabGroup: {
    position: 'absolute',
    right: 16,
    bottom: 16,
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
