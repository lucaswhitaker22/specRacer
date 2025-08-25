#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Text Racing MMO Production Environment...\n');

// Function to run a command in a specific directory
function runCommand(command, args, cwd, label) {
  return new Promise((resolve, reject) => {
    console.log(`📦 ${label}: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      cwd: path.join(__dirname, cwd),
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${label} completed successfully\n`);
        resolve();
      } else {
        console.error(`❌ ${label} failed with code ${code}\n`);
        reject(new Error(`${label} failed`));
      }
    });

    child.on('error', (error) => {
      console.error(`❌ ${label} error:`, error.message);
      reject(error);
    });
  });
}

async function main() {
  try {
    // Step 1: Install dependencies
    console.log('📦 Installing dependencies...');
    await runCommand('npm', ['run', 'install:all'], '.', 'Install Dependencies');

    // Step 2: Build all components
    console.log('🔧 Building application...');
    await runCommand('npm', ['run', 'build:all'], '.', 'Build Application');

    // Step 3: Set up database
    console.log('🗄️  Setting up database...');
    try {
      await runCommand('node', ['setup-database.js'], 'backend', 'Database Setup');
    } catch (error) {
      console.log('⚠️  Database setup failed - this is normal if database already exists');
    }

    // Step 4: Start production server
    console.log('🖥️  Starting production server...');
    await runCommand('npm', ['start'], '.', 'Production Server');

  } catch (error) {
    console.error('❌ Production start failed:', error.message);
    process.exit(1);
  }
}

main();