import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { TextInput, IconButton, Text, Menu } from 'react-native-paper';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useMessenger } from '../contexts/MessengerContext';
import nacl from 'tweetnacl';
import { Buffer } from 'buffer';

export default function GroupChatScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { groupId, groupName } = route.params as { groupId: string; groupName: string };

  const {
    groupMessages,
    sendGroupMessage,
    loadGroupMessages,
    joinGroupRoom,
    leaveGroupRoom,
    wallet,
  } = useMessenger();

  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Set header title
  useEffect(() => {
    navigation.setOptions({
      title: groupName,
      headerRight: () => (
        <IconButton
          icon="information-outline"
          onPress={() => navigation.navigate('GroupInfo' as never, { groupId, groupName } as never)}
        />
      ),
    });
  }, [groupName, groupId]);

  // Load messages and join room on mount
  useFocusEffect(
    React.useCallback(() => {
      loadGroupMessages(groupId);
      joinGroupRoom(groupId);

      return () => {
        leaveGroupRoom(groupId);
      };
    }, [groupId])
  );

  // Subscribe to group messages
  useEffect(() => {
    const msgs = groupMessages.get(groupId) || [];

    // Decrypt messages
    const decryptedMessages = msgs.map(msg => {
      if (msg.encrypted && msg.nonce) {
        // TODO: Decrypt with group symmetric key
        // For now, show encrypted placeholder
        return {
          ...msg,
          content: '[Encrypted Group Message]',
        };
      }
      return msg;
    });

    setMessages(decryptedMessages);
  }, [groupMessages, groupId]);

  const handleSend = async () => {
    if (!messageText.trim()) return;

    try {
      await sendGroupMessage(groupId, messageText.trim());
      setMessageText('');

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handleDeleteMessage = (messageId: string, isSender: boolean) => {
    // TODO: Implement group message deletion
    Alert.alert('Delete Message', 'Group message deletion coming soon!');
    setMenuVisible(null);
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender === wallet?.publicKey?.toBase58();

    return (
      <View style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]}>
        <TouchableOpacity
          onLongPress={() => setMenuVisible(item.id)}
          style={styles.messageBubble}
        >
          {!isMe && (
            <Text style={styles.senderName}>
              {item.sender.slice(0, 8)}...
            </Text>
          )}

          <Text style={styles.messageText}>{item.content}</Text>

          <Text style={styles.timestamp}>
            {new Date(item.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </TouchableOpacity>

        <Menu
          visible={menuVisible === item.id}
          onDismiss={() => setMenuVisible(null)}
          anchor={{ x: 0, y: 0 }}
        >
          <Menu.Item
            onPress={() => handleDeleteMessage(item.id, isMe)}
            title={isMe ? 'Delete for Everyone' : 'Delete for Me'}
          />
        </Menu>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      <View style={styles.inputContainer}>
        <TextInput
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Type a message..."
          mode="outlined"
          style={styles.input}
          multiline
          maxLength={1000}
          right={
            <TextInput.Icon
              icon="send"
              onPress={handleSend}
              disabled={!messageText.trim()}
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
    backgroundColor: '#0a0a0a',
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  myMessage: {
    alignSelf: 'flex-end',
  },
  theirMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 12,
  },
  senderName: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#ffffff',
  },
  timestamp: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    padding: 8,
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  input: {
    backgroundColor: '#1a1a1a',
  },
});
