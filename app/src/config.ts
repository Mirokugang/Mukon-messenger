// Backend configuration
// Change this based on your environment:
// - Local WiFi: Use your host machine's IP (check with `ifconfig` or `ipconfig`)
// - Production: Use Fly.io or other hosted URL
// - Emulator: Use 10.0.2.2:3001

export const BACKEND_URL = __DEV__
  ? 'http://192.168.1.33:3001'  // Home WiFi IP
  : 'https://mukon-backend.fly.dev';  // Production URL (deploy later)

// Quick reference:
// Home WiFi example: 'http://192.168.1.33:3001'
// Office WiFi example: 'http://10.0.0.100:3001'
// Android Emulator: 'http://10.0.2.2:3001'
// ngrok tunnel: 'https://abc123.ngrok.io'
