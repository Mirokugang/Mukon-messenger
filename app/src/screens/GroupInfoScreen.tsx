import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { List, Button, Text, Divider, Avatar } from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useMessenger } from '../contexts/MessengerContext';
import { PublicKey } from '@solana/web3.js';

export default function GroupInfoScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { groupId, groupName } = route.params as { groupId: string; groupName: string };

  const { groups, leaveGroup, kickMember, wallet, loading } = useMessenger();

  const [group, setGroup] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Find group in loaded groups
    const foundGroup = groups.find(g => Buffer.from(g.groupId).toString('hex') === groupId);
    setGroup(foundGroup);

    if (foundGroup && wallet?.publicKey) {
      setIsAdmin(foundGroup.creator.equals(wallet.publicKey));
    }
  }, [groups, groupId, wallet]);

  const handleInviteMember = () => {
    navigation.navigate('InviteMember' as never, { groupId, groupName } as never);
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveGroup(Buffer.from(groupId, 'hex'));
              navigation.goBack();
              navigation.goBack(); // Go back to conversations list
            } catch (error) {
              Alert.alert('Error', `Failed to leave group: ${error.message}`);
            }
          },
        },
      ]
    );
  };

  const handleKickMember = (memberPubkey: PublicKey) => {
    Alert.alert(
      'Kick Member',
      'Are you sure you want to remove this member?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Kick',
          style: 'destructive',
          onPress: async () => {
            try {
              await kickMember(Buffer.from(groupId, 'hex'), memberPubkey);
              // Reload group info
            } catch (error) {
              Alert.alert('Error', `Failed to kick member: ${error.message}`);
            }
          },
        },
      ]
    );
  };

  if (!group) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading group info...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Avatar.Text size={80} label={groupName.slice(0, 2).toUpperCase()} />
        <Text variant="headlineSmall" style={styles.groupName}>
          {groupName}
        </Text>
        <Text variant="bodyMedium" style={styles.memberCount}>
          {group.members.length} members
        </Text>
      </View>

      <Divider style={styles.divider} />

      <List.Section>
        <List.Subheader style={styles.subheader}>Group Info</List.Subheader>

        <List.Item
          title="Created by"
          description={group.creator.toBase58().slice(0, 16) + '...'}
          left={(props) => <List.Icon {...props} icon="account-star" />}
        />

        <List.Item
          title="Created"
          description={new Date(Number(group.createdAt) * 1000).toLocaleDateString()}
          left={(props) => <List.Icon {...props} icon="calendar" />}
        />

        {group.tokenGate && (
          <List.Item
            title="Token Gated"
            description={`Min balance: ${group.tokenGate.minBalance.toString()}`}
            left={(props) => <List.Icon {...props} icon="lock" />}
          />
        )}
      </List.Section>

      <Divider style={styles.divider} />

      <List.Section>
        <List.Subheader style={styles.subheader}>
          Members ({group.members.length})
        </List.Subheader>

        {group.members.map((member: PublicKey, index: number) => {
          const memberPubkey = member.toBase58();
          const isSelf = wallet?.publicKey?.equals(member);
          const isCreator = group.creator.equals(member);

          return (
            <List.Item
              key={memberPubkey}
              title={memberPubkey.slice(0, 16) + '...'}
              description={isCreator ? 'Admin' : 'Member'}
              left={(props) => (
                <Avatar.Text
                  {...props}
                  size={40}
                  label={memberPubkey.slice(0, 2).toUpperCase()}
                />
              )}
              right={
                isAdmin && !isSelf && !isCreator
                  ? (props) => (
                      <Button
                        {...props}
                        mode="text"
                        textColor="#ff4444"
                        onPress={() => handleKickMember(member)}
                      >
                        Kick
                      </Button>
                    )
                  : undefined
              }
            />
          );
        })}
      </List.Section>

      <View style={styles.actions}>
        {isAdmin && (
          <Button
            mode="contained"
            icon="account-plus"
            onPress={handleInviteMember}
            style={styles.actionButton}
          >
            Invite Members
          </Button>
        )}

        {!isAdmin && (
          <Button
            mode="outlined"
            icon="exit-to-app"
            onPress={handleLeaveGroup}
            style={styles.actionButton}
            textColor="#ff4444"
          >
            Leave Group
          </Button>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 32,
  },
  header: {
    alignItems: 'center',
    padding: 24,
  },
  groupName: {
    color: '#ffffff',
    marginTop: 16,
  },
  memberCount: {
    color: '#888',
    marginTop: 4,
  },
  divider: {
    backgroundColor: '#333',
  },
  subheader: {
    color: '#888',
  },
  actions: {
    padding: 16,
    paddingBottom: 32,
  },
  actionButton: {
    marginBottom: 12,
  },
});
