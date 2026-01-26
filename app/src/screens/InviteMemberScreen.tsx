import React, { useState } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { List, Checkbox, Button, Text, Searchbar } from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useMessenger } from '../contexts/MessengerContext';
import { PublicKey } from '@solana/web3.js';

export default function InviteMemberScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { groupId, groupName } = route.params as { groupId: string; groupName: string };

  const { contacts, inviteToGroup, loading } = useMessenger();

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

  const handleInvite = async () => {
    if (selectedContacts.size === 0) {
      Alert.alert('Error', 'Please select at least one contact');
      return;
    }

    try {
      const groupIdBytes = Buffer.from(groupId, 'hex');

      // Invite each selected contact
      for (const pubkeyStr of Array.from(selectedContacts)) {
        const pubkey = new PublicKey(pubkeyStr);
        await inviteToGroup(groupIdBytes, pubkey);
      }

      Alert.alert(
        'Success',
        `Invited ${selectedContacts.size} member(s) to ${groupName}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Failed to invite members:', error);
      Alert.alert('Error', `Failed to invite members: ${error.message}`);
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
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleLarge" style={styles.title}>
          Invite to {groupName}
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Select contacts to invite
        </Text>
      </View>

      <Searchbar
        placeholder="Search contacts..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      <FlatList
        data={filteredContacts}
        renderItem={renderContact}
        keyExtractor={(item) => item.publicKey.toBase58()}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery
                ? 'No contacts found'
                : 'No accepted contacts. Add contacts first!'}
            </Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <Text style={styles.selectedCount}>
          {selectedContacts.size} selected
        </Text>
        <Button
          mode="contained"
          onPress={handleInvite}
          loading={loading}
          disabled={loading || selectedContacts.size === 0}
          style={styles.inviteButton}
        >
          Send Invites
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    color: '#ffffff',
  },
  subtitle: {
    color: '#888',
    marginTop: 4,
  },
  searchBar: {
    margin: 16,
    backgroundColor: '#1a1a1a',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
    backgroundColor: '#0a0a0a',
  },
  selectedCount: {
    color: '#888',
    marginBottom: 12,
    textAlign: 'center',
  },
  inviteButton: {
    width: '100%',
  },
});
