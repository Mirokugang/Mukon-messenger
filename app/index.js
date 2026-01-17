import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import { Buffer } from '@craftzdog/react-native-buffer';
import 'text-encoding-polyfill';

// Polyfills for Solana web3.js and Anchor
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// Critical: Extend Buffer.prototype.subarray for Anchor compatibility
// This adds readUIntLE and other methods needed by Anchor
const originalSubarray = Buffer.prototype.subarray;
Buffer.prototype.subarray = function (...args) {
  const result = originalSubarray.apply(this, args);
  Object.setPrototypeOf(result, Buffer.prototype);
  return result;
};

// Polyfill for structuredClone (not available in React Native)
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
