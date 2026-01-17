import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import { Buffer } from '@craftzdog/react-native-buffer';
import { TextEncoder, TextDecoder } from 'fast-text-encoding';

// Polyfills for Solana web3.js
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// Polyfill for structuredClone (not available in React Native)
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

// TextEncoder/TextDecoder polyfills
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
