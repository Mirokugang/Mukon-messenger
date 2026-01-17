import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import { Buffer } from '@craftzdog/react-native-buffer';
import 'text-encoding-polyfill';

// Polyfills for Solana web3.js
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// Polyfill for structuredClone (not available in React Native)
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
