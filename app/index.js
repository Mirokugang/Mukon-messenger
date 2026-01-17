import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import { Buffer } from '@craftzdog/react-native-buffer';

// Polyfills for Solana web3.js
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
