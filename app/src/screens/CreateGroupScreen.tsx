import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Text, Switch, Portal, Dialog } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useMessenger } from '../contexts/MessengerContext';
import { PublicKey } from '@solana/web3.js';

export default function CreateGroupScreen() {
  const navigation = useNavigation();
  const { createGroup, loading } = useMessenger();

  const [groupName, setGroupName] = useState('');
  const [tokenGateEnabled, setTokenGateEnabled] = useState(false);
  const [tokenMint, setTokenMint] = useState('');
  const [minBalance, setMinBalance] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

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

      const { groupId, txSignature } = await createGroup(groupName, tokenGate);
      console.log('✅ Group created:', Buffer.from(groupId).toString('hex'));
      console.log('Transaction:', txSignature);

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

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <Text variant="headlineSmall" style={styles.title}>
          Create New Group
        </Text>

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

        <Button
          mode="contained"
          onPress={handleCreateGroup}
          loading={loading}
          disabled={loading || !groupName.trim()}
          style={styles.createButton}
        >
          Create Group
        </Button>

        <Text variant="bodySmall" style={styles.infoText}>
          After creating the group, you can invite contacts from your list.
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
});
