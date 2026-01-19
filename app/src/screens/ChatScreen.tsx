import React from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, IconButton, Text, Avatar } from 'react-native-paper';
import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { theme } from '../theme';
import { useWallet } from '../contexts/WalletContext';
import { useMukonMessenger } from '../hooks/useMukonMessenger';
import { getChatHash } from '../utils/encryption';

export default function ChatScreen({ route, navigation }: any) {
  const { contact } = route.params;
  const [message, setMessage] = React.useState('');
  const wallet = useWallet();
  const messenger = useMukonMessenger(wallet, 'devnet');

  // Get conversation ID from the two public keys
  const conversationId = React.useMemo(() => {
    if (!wallet.publicKey) return '';
    const chatHash = getChatHash(wallet.publicKey, new PublicKey(contact.pubkey));
    return Buffer.from(chatHash).toString('hex');
  }, [wallet.publicKey, contact.pubkey]);

  // Join conversation room when screen mounts
  React.useEffect(() => {
    if (conversationId && messenger.socket) {
      messenger.joinConversation(conversationId);

      return () => {
        messenger.leaveConversation(conversationId);
      };
    }
  }, [conversationId, messenger.socket]);

  // Get messages for this conversation
  const conversationMessages = messenger.messages.get(conversationId) || [];

  const messages = conversationMessages.map((msg: any, idx: number) => {
    const isMe = msg.sender === wallet.publicKey?.toBase58();
    let content = msg.content || '[No content]';

    // Only decrypt if it's NOT our message AND it's encrypted
    if (!isMe && msg.encrypted && msg.nonce && !msg.content) {
      try {
        const senderPubkey = new PublicKey(msg.sender);
        const decrypted = messenger.decryptConversationMessage(
          msg.encrypted,
          msg.nonce,
          senderPubkey
        );
        content = decrypted || '[Unable to decrypt]';
      } catch (error) {
        console.error('Failed to decrypt message:', error);
        content = '[Decryption failed]';
      }
    }

    return {
      id: msg.id || `${idx}`,
      sender: msg.sender,
      content,
      timestamp: new Date(msg.timestamp || Date.now()),
      isMe,
    };
  });

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitle}>
          <Text style={styles.headerName}>
            {contact.displayName || contact.pubkey}
          </Text>
        </View>
      ),
      headerRight: () => (
        <IconButton
          icon="lock"
          size={20}
          iconColor={theme.colors.secondary}
        />
      ),
    });
  }, [navigation, contact]);

  const sendMessage = async () => {
    if (!message.trim() || !wallet.publicKey) return;

    try {
      await messenger.sendMessage(
        conversationId,
        message.trim(),
        new PublicKey(contact.pubkey)
      );
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const renderMessage = ({ item }: any) => (
    <View
      style={[
        styles.messageBubble,
        item.isMe ? styles.myMessage : styles.theirMessage,
      ]}
    >
      <Text style={styles.messageText}>{item.content}</Text>
      <Text style={styles.messageTime}>
        {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        inverted
      />
      <View style={styles.inputContainer}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Message..."
          mode="outlined"
          style={styles.input}
          outlineColor="transparent"
          activeOutlineColor={theme.colors.primary}
          placeholderTextColor={theme.colors.textSecondary}
          right={
            <TextInput.Icon
              icon="send"
              onPress={sendMessage}
              color={message.trim() ? theme.colors.primary : theme.colors.textSecondary}
            />
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerTitle: {
    flexDirection: 'column',
  },
  headerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  messagesList: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.primary,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surface,
  },
  messageText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
  },
  messageTime: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.background,
  },
  input: {
    backgroundColor: theme.colors.background,
  },
});
