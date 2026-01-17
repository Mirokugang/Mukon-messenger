import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import 'text-encoding-polyfill';

// Polyfills for Solana web3.js and Anchor (per Solana Mobile docs)
global.Buffer = Buffer;

// CRITICAL: Buffer.prototype.subarray fix for Anchor in React Native
// From: https://docs.solanamobile.com/react-native/polyfill-guides/anchor
Buffer.prototype.subarray = function subarray(begin, end) {
  const result = Uint8Array.prototype.subarray.apply(this, [begin, end]);
  Object.setPrototypeOf(result, Buffer.prototype); // Adds readUIntLE!
  return result;
};

// Polyfill for structuredClone (not available in React Native)
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
