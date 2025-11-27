#!/usr/bin/env node
/**
 * @version v34
 * @description Helper script to add version comments to all project files
 */

const fs = require('fs');
const path = require('path');

const VERSION = 'v34';
const VERSION_COMMENT = `/**
 * @version ${VERSION} - KCY1 Token - Centralized Addresses
 */

`;

const SOLIDITY_VERSION_COMMENT = `/**
 * @title KCY-meme-1 Token (KCY1) - ${VERSION}
 */
`;

// Directories to process
const directories = [
  'scripts',
  'test',
  'utils'
];

// Files to process
function addVersionToFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check if version comment already exists
  if (content.includes('@version')) {
    console.log(`  ✓ Already versioned: ${filePath}`);
    return;
  }
  
  // Add version comment at the beginning
  const newContent = VERSION_COMMENT + content;
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`  ✓ Added version to: ${filePath}`);
}

// Process directories
console.log(`\nAdding version ${VERSION} to project files...\n`);

directories.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  
  if (!fs.existsSync(dirPath)) {
    console.log(`  ⚠ Directory not found: ${dir}`);
    return;
  }
  
  console.log(`Processing ${dir}/...`);
  
  const files = fs.readdirSync(dirPath)
    .filter(file => file.endsWith('.js'));
  
  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    addVersionToFile(filePath);
  });
  
  console.log('');
});

console.log('✅ Version addition complete!\n');
