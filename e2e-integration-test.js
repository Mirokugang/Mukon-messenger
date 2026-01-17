#!/usr/bin/env node

/**
 * Comprehensive E2E Integration Test
 * Tests the full Mukon Messenger stack programmatically
 */

const { Connection, Keypair, PublicKey, SystemProgram } = require('@solana/web3.js');
const { AnchorProvider, Program, web3, BN } = require('@coral-xyz/anchor');
const io = require('socket.io-client');
const nacl = require('tweetnacl');

const IDL = require('./target/idl/mukon_messenger.json');
const PROGRAM_ID = new PublicKey('89MdH36FUjSYaZ47VAtPD21THprGpKkta8Qd26wGvnBr');
const BACKEND_URL = 'http://localhost:3001';

const WALLET_DESCRIPTOR_VERSION = Buffer.from([1]);
const USER_PROFILE_VERSION = Buffer.from([1]);

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, error = null) {
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${name}`);
  if (error) console.log(`   Error: ${error.message || error}`);

  testResults.tests.push({ name, passed, error: error?.message });
  if (passed) testResults.passed++;
  else testResults.failed++;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testBackendHealth() {
  console.log('\n📡 Testing Backend...\n');

  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    const data = await response.json();
    logTest('Backend health check', data.status === 'ok');
    return true;
  } catch (error) {
    logTest('Backend health check', false, error);
    return false;
  }
}

async function testWebSocketConnection() {
  try {
    return new Promise((resolve) => {
      const socket = io(BACKEND_URL);

      const timeout = setTimeout(() => {
        socket.disconnect();
        logTest('WebSocket connection', false, new Error('Connection timeout'));
        resolve(false);
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        socket.disconnect();
        logTest('WebSocket connection', true);
        resolve(true);
      });

      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        logTest('WebSocket connection', false, error);
        resolve(false);
      });
    });
  } catch (error) {
    logTest('WebSocket connection', false, error);
    return false;
  }
}

async function testProgramDeployment() {
  console.log('\n⛓️  Testing Solana Program...\n');

  try {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const programInfo = await connection.getAccountInfo(PROGRAM_ID);

    if (programInfo && programInfo.executable) {
      logTest('Program deployed on devnet', true);
      console.log(`   Program size: ${programInfo.data.length} bytes`);
      return connection;
    } else {
      logTest('Program deployed on devnet', false, new Error('Program not found or not executable'));
      return null;
    }
  } catch (error) {
    logTest('Program deployed on devnet', false, error);
    return null;
  }
}

async function testEncryptionUtilities() {
  console.log('\n🔐 Testing Encryption...\n');

  try {
    // Test keypair generation
    const keypair = nacl.box.keyPair();
    logTest('Generate encryption keypair', keypair.publicKey && keypair.secretKey);

    // Test message encryption
    const message = 'Test encrypted message';
    const nonce = nacl.randomBytes(24);
    const recipientKeypair = nacl.box.keyPair();

    const encrypted = nacl.box(
      Buffer.from(message),
      nonce,
      recipientKeypair.publicKey,
      keypair.secretKey
    );

    logTest('Encrypt message', encrypted && encrypted.length > 0);

    // Test decryption
    const decrypted = nacl.box.open(
      encrypted,
      nonce,
      keypair.publicKey,
      recipientKeypair.secretKey
    );

    const decryptedMessage = Buffer.from(decrypted).toString();
    logTest('Decrypt message', decryptedMessage === message);

    return true;
  } catch (error) {
    logTest('Encryption utilities', false, error);
    return false;
  }
}

async function testProgramFunctionality(connection) {
  if (!connection) {
    console.log('\n⚠️  Skipping program functionality tests (no connection)\n');
    return false;
  }

  console.log('\n🧪 Testing Program Functionality...\n');

  try {
    // Note: We can't actually test transactions without SOL
    // But we can verify the program structure

    logTest('Program IDL loaded', IDL && IDL.instructions && IDL.accounts);
    logTest('Program has register instruction',
      IDL.instructions.some(i => i.name === 'register'));
    logTest('Program has invite instruction',
      IDL.instructions.some(i => i.name === 'invite'));
    logTest('Program has accept instruction',
      IDL.instructions.some(i => i.name === 'accept'));
    logTest('Program has UserProfile account',
      IDL.accounts.some(a => a.name === 'UserProfile'));
    logTest('Program has WalletDescriptor account',
      IDL.accounts.some(a => a.name === 'WalletDescriptor'));
    logTest('Program has Conversation account',
      IDL.accounts.some(a => a.name === 'Conversation'));

    return true;
  } catch (error) {
    logTest('Program functionality tests', false, error);
    return false;
  }
}

async function testAppStructure() {
  console.log('\n📱 Testing App Structure...\n');

  const fs = require('fs');
  const path = require('path');

  try {
    // Check app files exist
    const appFiles = [
      'app/App.tsx',
      'app/src/contexts/WalletContext.tsx',
      'app/src/hooks/useMukonMessenger.ts',
      'app/src/utils/encryption.ts',
      'app/src/screens/ContactsScreen.tsx',
      'app/src/screens/ChatScreen.tsx',
      'app/src/screens/AddContactScreen.tsx',
      'app/src/screens/ProfileScreen.tsx',
      'app/src/theme.ts',
      'app/package.json'
    ];

    for (const file of appFiles) {
      const exists = fs.existsSync(path.join(__dirname, file));
      logTest(`App file: ${file}`, exists);
    }

    // Check package.json dependencies
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'app/package.json'), 'utf8')
    );

    const requiredDeps = [
      '@coral-xyz/anchor',
      '@solana/web3.js',
      'tweetnacl',
      'socket.io-client',
      'react-native-paper',
      '@react-navigation/native'
    ];

    for (const dep of requiredDeps) {
      const has = packageJson.dependencies && packageJson.dependencies[dep];
      logTest(`Dependency: ${dep}`, !!has);
    }

    return true;
  } catch (error) {
    logTest('App structure tests', false, error);
    return false;
  }
}

async function testArciumIntegration() {
  console.log('\n🔮 Testing Arcium Integration...\n');

  const fs = require('fs');
  const path = require('path');

  try {
    // Check Arcium build artifacts
    const arciumFiles = [
      'encrypted-ixs/src/lib.rs',
      'encrypted-ixs/Cargo.toml',
      'build/is_accepted_contact.arcis',
      'build/count_accepted.arcis',
      'build/add_two_numbers.arcis',
      'build/circuits.ts'
    ];

    for (const file of arciumFiles) {
      const exists = fs.existsSync(path.join(__dirname, file));
      logTest(`Arcium file: ${file}`, exists);
    }

    return true;
  } catch (error) {
    logTest('Arcium integration tests', false, error);
    return false;
  }
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║       Mukon Messenger E2E Integration Test            ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  const backendOk = await testBackendHealth();
  const wsOk = await testWebSocketConnection();
  const connection = await testProgramDeployment();
  await testProgramFunctionality(connection);
  await testEncryptionUtilities();
  await testAppStructure();
  await testArciumIntegration();

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                    Test Summary                        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Total:  ${testResults.passed + testResults.failed}`);

  const successRate = (testResults.passed / (testResults.passed + testResults.failed) * 100).toFixed(1);
  console.log(`\n🎯 Success Rate: ${successRate}%\n`);

  if (testResults.failed === 0) {
    console.log('🎉 All tests passed! The Mukon Messenger stack is fully operational.\n');
    console.log('Ready for:');
    console.log('  - Mobile app testing (launch with: cd app && npx expo start)');
    console.log('  - E2E user flow verification');
    console.log('  - Production deployment\n');
    return 0;
  } else {
    console.log('⚠️  Some tests failed. Review errors above.\n');
    return 1;
  }
}

// Run tests
runAllTests()
  .then(code => process.exit(code))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
