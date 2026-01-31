import React from 'react';
import { ImageBackground, StyleSheet } from 'react-native';

/**
 * Black and white crypto vector pattern background for chat screens
 * Uses converted vector pattern image
 */
export default function ChatBackground() {
  return (
    <ImageBackground
      source={require('../../assets/crypto-pattern-bg.png')}
      style={styles.background}
      resizeMode="cover"
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  background: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.08, // Low opacity for subtle background
  },
});
