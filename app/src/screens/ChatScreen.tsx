import React from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, IconButton, Text, Avatar } from 'react-native-paper';
import { theme } from '../theme';

export default function ChatScreen({ route, navigation }: any) {
  const { contact } = route.params;
  const [message, setMessage] = React.useState('');

  // Mock messages - replace with actual messages from useMukonMessenger
  const messages = [
    {
      id: '1',
      sender: contact.pubkey,
      content: 'Hey, you free to chat?',
      timestamp: new Date(Date.now() - 120000),
      isMe: false,
    },
    {
      id: '2',
      sender: 'me',
      content: "Yeah what's up?",
      timestamp: new Date(Date.now() - 60000),
      isMe: true,
    },
  ];

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

  const sendMessage = () => {
    if (!message.trim()) return;
    // TODO: Use useMukonMessenger hook to send encrypted message
    console.log('Sending message:', message);
    setMessage('');
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
