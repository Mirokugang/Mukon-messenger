import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, FlatList, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, Switch, Portal, Dialog, List, Checkbox, Searchbar, IconButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useMessenger } from '../contexts/MessengerContext';
import { PublicKey } from '@solana/web3.js';
import { setGroupAvatar } from '../utils/domains';
import { useWallet } from '../contexts/WalletContext';
import EmojiPicker from '../components/EmojiPicker';
import { theme } from '../theme';

export default function CreateGroupScreen() {
  const navigation = useNavigation();
  const wallet = useWallet();
  const { createGroupWithMembers, contacts, loading } = useMessenger();

  const [groupName, setGroupName] = useState('');
  const [groupEmoji, setGroupEmoji] = useState<string | null>(null);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [tokenGateEnabled, setTokenGateEnabled] = useState(false);
  const [tokenMint, setTokenMint] = useState('');
  const [minBalance, setMinBalance] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Filter to only accepted contacts
  const acceptedContacts = contacts.filter(c => c.state === 'Accepted');

  // Filter by search query
  const filteredContacts = acceptedContacts.filter(contact => {
    const pubkey = contact.publicKey.toBase58().toLowerCase();
    const displayName = contact.displayName?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();

    return pubkey.includes(query) || displayName.includes(query);
  });

  const toggleContact = (pubkey: string) => {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(pubkey)) {
        next.delete(pubkey);
      } else {
        next.add(pubkey);
      }
      return next;
    });
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    if (groupName.length > 64) {
      Alert.alert('Error', 'Group name must be 64 characters or less');
      return;
    }

    try {
      let tokenGate = undefined;

      if (tokenGateEnabled) {
        if (!tokenMint.trim()) {
          Alert.alert('Error', 'Please enter a token mint address');
          return;
        }

        try {
          new PublicKey(tokenMint);
        } catch {
          Alert.alert('Error', 'Invalid token mint address');
          return;
        }

        const balance = parseFloat(minBalance);
        if (isNaN(balance) || balance <= 0) {
          Alert.alert('Error', 'Please enter a valid minimum balance');
          return;
        }

        tokenGate = {
          mint: new PublicKey(tokenMint),
          minBalance: BigInt(Math.floor(balance * 1_000_000)), // Convert to base units (6 decimals)
        };
      }

      // Convert selected contacts to PublicKey array
      const invitees = Array.from(selectedContacts).map(pubkeyStr => new PublicKey(pubkeyStr));

      const { groupId, txSignature } = await createGroupWithMembers(groupName, invitees, tokenGate);
      const groupIdHex = Buffer.from(groupId).toString('hex');
      console.log('✅ Group created with', invitees.length, 'invites:', groupIdHex);
      console.log('Transaction:', txSignature);

      // Save group avatar if selected (Feature 6)
      if (groupEmoji && wallet.publicKey) {
        await setGroupAvatar(wallet.publicKey, groupIdHex, groupEmoji);
        console.log('✅ Group avatar saved:', groupEmoji);
      }

      setShowSuccess(true);

      // Navigate to group chat after short delay
      setTimeout(() => {
        setShowSuccess(false);
        navigation.goBack();
      }, 2000);
    } catch (error) {
      console.error('Failed to create group:', error);
      Alert.alert('Error', `Failed to create group: ${error.message}`);
    }
  };

  const renderContact = ({ item }: { item: any }) => {
    const pubkey = item.publicKey.toBase58();
    const isSelected = selectedContacts.has(pubkey);

    return (
      <List.Item
        title={item.displayName || pubkey.slice(0, 16) + '...'}
        description={pubkey.slice(0, 32) + '...'}
        left={(props) => (
          <Checkbox
            {...props}
            status={isSelected ? 'checked' : 'unchecked'}
            onPress={() => toggleContact(pubkey)}
          />
        )}
        onPress={() => toggleContact(pubkey)}
        style={styles.contactItem}
      />
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <Text variant="headlineSmall" style={styles.title}>
          Create New Group
        </Text>

        {/* Group Avatar Selector */}
        <TouchableOpacity onPress={() => setEmojiPickerVisible(true)} style={styles.avatarSelector}>
          {groupEmoji ? (
            <View style={styles.emojiAvatar}>
              <Text style={styles.emojiAvatarText}>{groupEmoji}</Text>
            </View>
          ) : (
            <View style={styles.emojiAvatarPlaceholder}>
              <IconButton icon="camera-plus" size={32} iconColor={theme.colors.textSecondary} />
              <Text style={styles.avatarHint}>Add Group Avatar</Text>
            </View>
          )}
        </TouchableOpacity>

        <TextInput
          label="Group Name"
          value={groupName}
          onChangeText={setGroupName}
          mode="outlined"
          style={styles.input}
          maxLength={64}
          placeholder="e.g., Crypto Devs, Mukon Team"
        />

        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text variant="titleMedium">Token Gating</Text>
            <Text variant="bodySmall" style={styles.subtitle}>
              Require users to hold a specific token
            </Text>
          </View>
          <Switch value={tokenGateEnabled} onValueChange={setTokenGateEnabled} />
        </View>

        {tokenGateEnabled && (
          <View style={styles.tokenGateSection}>
            <TextInput
              label="Token Mint Address"
              value={tokenMint}
              onChangeText={setTokenMint}
              mode="outlined"
              style={styles.input}
              placeholder="e.g., EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
            />

            <TextInput
              label="Minimum Balance"
              value={minBalance}
              onChangeText={setMinBalance}
              mode="outlined"
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="e.g., 100"
            />

            <Text variant="bodySmall" style={styles.helperText}>
              Users must hold at least this amount to join
            </Text>
          </View>
        )}

        <View style={styles.contactsSection}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Invite Members (Optional)
          </Text>
          <Text variant="bodySmall" style={styles.subtitle}>
            Select contacts to invite in the same transaction
          </Text>

          {acceptedContacts.length > 0 && (
            <Searchbar
              placeholder="Search contacts..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchbar}
            />
          )}

          {acceptedContacts.length === 0 ? (
            <Text variant="bodyMedium" style={styles.noContactsText}>
              No contacts available. Add contacts first to invite them to groups.
            </Text>
          ) : (
            <View style={styles.contactsList}>
              <FlatList
                data={filteredContacts}
                keyExtractor={(item) => item.publicKey.toBase58()}
                renderItem={renderContact}
                scrollEnabled={false}
                ListEmptyComponent={
                  <Text variant="bodyMedium" style={styles.noContactsText}>
                    No contacts match your search
                  </Text>
                }
              />
            </View>
          )}

          {selectedContacts.size > 0 && (
            <Text variant="bodySmall" style={styles.selectionInfo}>
              {selectedContacts.size} member(s) selected
              {selectedContacts.size > 8 && ' (⚠️ Multiple transactions will be needed for >8 members)'}
            </Text>
          )}
        </View>

        <Button
          mode="contained"
          onPress={handleCreateGroup}
          loading={loading}
          disabled={loading || !groupName.trim()}
          style={styles.createButton}
        >
          {selectedContacts.size > 0
            ? `Create Group & Invite ${selectedContacts.size} Members`
            : 'Create Group'}
        </Button>

        <Text variant="bodySmall" style={styles.infoText}>
          {selectedContacts.size > 0
            ? 'Group and invitations will be sent in a single transaction'
            : 'You can invite members later from the group settings'}
        </Text>
      </View>

      <Portal>
        <Dialog visible={showSuccess} onDismiss={() => setShowSuccess(false)}>
          <Dialog.Title>Success! 🎉</Dialog.Title>
          <Dialog.Content>
            <Text>Group created successfully!</Text>
          </Dialog.Content>
        </Dialog>
      </Portal>

      {/* Emoji Picker for Group Avatar */}
      <EmojiPicker
        visible={emojiPickerVisible}
        onDismiss={() => setEmojiPickerVisible(false)}
        onSelect={(emoji) => {
          setGroupEmoji(emoji);
          setEmojiPickerVisible(false);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  form: {
    padding: 16,
  },
  title: {
    marginBottom: 24,
    color: '#ffffff',
  },
  input: {
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  switchLabel: {
    flex: 1,
  },
  subtitle: {
    color: '#888',
    marginTop: 4,
  },
  tokenGateSection: {
    marginTop: 8,
  },
  helperText: {
    color: '#888',
    marginTop: -8,
    marginBottom: 16,
  },
  createButton: {
    marginTop: 24,
    marginBottom: 16,
  },
  infoText: {
    color: '#888',
    textAlign: 'center',
  },
  contactsSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    marginBottom: 4,
  },
  searchbar: {
    marginVertical: 12,
    backgroundColor: '#1a1a1a',
  },
  contactsList: {
    maxHeight: 300,
    marginTop: 8,
  },
  contactItem: {
    backgroundColor: '#1a1a1a',
    marginBottom: 4,
    borderRadius: 8,
  },
  noContactsText: {
    color: '#888',
    textAlign: 'center',
    paddingVertical: 24,
  },
  selectionInfo: {
    color: '#4CAF50',
    marginTop: 12,
    textAlign: 'center',
  },
  avatarSelector: {
    alignSelf: 'center',
    marginBottom: 24,
  },
  emojiAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiAvatarText: {
    fontSize: 64,
  },
  emojiAvatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  avatarHint: {
    fontSize: 10,
    color: '#888',
    marginTop: 4,
    textAlign: 'center',
  },
});
