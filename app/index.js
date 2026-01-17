import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import { Buffer } from 'buffer';

// Polyfills for Solana web3.js
global.Buffer = Buffer;

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
