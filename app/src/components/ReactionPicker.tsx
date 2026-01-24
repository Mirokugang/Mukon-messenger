import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Dialog, Portal } from 'react-native-paper';
import { theme } from '../theme';

interface ReactionPickerProps {
  visible: boolean;
  onDismiss: () => void;
  onSelect: (emoji: string) => void;
}

// Quick reaction emojis (Telegram-style)
const REACTIONS = ['❤️', '🔥', '💯', '😂', '👍', '👎', '😮', '🎉'];

export default function ReactionPicker({ visible, onDismiss, onSelect }: ReactionPickerProps) {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Content style={styles.content}>
          <View style={styles.reactionGrid}>
            {REACTIONS.map((emoji, index) => (
              <TouchableOpacity
                key={index}
                style={styles.reactionButton}
                onPress={() => {
                  onSelect(emoji);
                  onDismiss();
                }}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Dialog.Content>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    backgroundColor: theme.colors.surface,
  },
  content: {
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  reactionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  reactionButton: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
    backgroundColor: theme.colors.background,
  },
  reactionEmoji: {
    fontSize: 32,
  },
});
