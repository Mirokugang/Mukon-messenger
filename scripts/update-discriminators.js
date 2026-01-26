#!/usr/bin/env node

/**
 * Extracts instruction discriminators from Anchor IDL and updates transactions.ts
 *
 * Run this after: anchor build && anchor deploy
 * Usage: node scripts/update-discriminators.js
 */

const fs = require('fs');
const path = require('path');

// Paths
const IDL_PATH = path.join(__dirname, '../target/idl/mukon_messenger.json');
const TRANSACTIONS_PATH = path.join(__dirname, '../app/src/utils/transactions.ts');

function bufferToHex(buffer) {
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function extractDiscriminators(idl) {
  const discriminators = {};

  for (const instruction of idl.instructions) {
    const name = instruction.name;
    const discriminator = instruction.discriminator;

    if (!discriminator || discriminator.length !== 8) {
      console.warn(`⚠️  Warning: ${name} has invalid discriminator`);
      continue;
    }

    // Convert camelCase to the key format used in transactions.ts
    const key = name;
    discriminators[key] = discriminator;
  }

  return discriminators;
}

function updateTransactionsFile(discriminators) {
  let content = fs.readFileSync(TRANSACTIONS_PATH, 'utf8');

  // Build the new DISCRIMINATORS object
  const lines = [];
  lines.push('const DISCRIMINATORS = {');

  for (const [name, disc] of Object.entries(discriminators)) {
    const hex = bufferToHex(disc);
    const byteArray = disc.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', ');
    lines.push(`  ${name}: Buffer.from([${byteArray}]), // ${hex}`);
  }

  lines.push('};');
  const newDiscriminators = lines.join('\n');

  // Replace the DISCRIMINATORS object
  const regex = /const DISCRIMINATORS = \{[^}]*\};/s;

  if (!regex.test(content)) {
    console.error('❌ Could not find DISCRIMINATORS object in transactions.ts');
    process.exit(1);
  }

  content = content.replace(regex, newDiscriminators);

  fs.writeFileSync(TRANSACTIONS_PATH, content, 'utf8');
}

function main() {
  console.log('🔍 Reading IDL from:', IDL_PATH);

  if (!fs.existsSync(IDL_PATH)) {
    console.error('❌ IDL file not found. Run "anchor build" first.');
    process.exit(1);
  }

  const idl = JSON.parse(fs.readFileSync(IDL_PATH, 'utf8'));

  console.log(`📦 Found ${idl.instructions.length} instructions in IDL`);

  const discriminators = extractDiscriminators(idl);

  console.log('📝 Extracted discriminators:');
  for (const [name, disc] of Object.entries(discriminators)) {
    console.log(`   ${name}: ${bufferToHex(disc)}`);
  }

  console.log('\n✏️  Updating transactions.ts...');
  updateTransactionsFile(discriminators);

  console.log('✅ Done! Discriminators updated in transactions.ts');
  console.log('\nNext steps:');
  console.log('1. Review the changes in app/src/utils/transactions.ts');
  console.log('2. Test the updated transactions with: npm run build (in app directory)');
}

main();
