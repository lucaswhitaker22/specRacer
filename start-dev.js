#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Text Racing MMO Development Environment...\n');

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

// Function to run a command without waiting for completion (for servers)
function runServer(command, args, cwd, label) {
  console.log(`🖥️  Starting ${label}: ${command} ${args.join(' ')}`);
  
  const child = spawn(command, args, {
    cwd: path.join(__dirname, cwd),
    stdio: 'inherit',
    shell: true
  });

  child.on('error', (error) => {
    console.error(`❌ ${label} error:`, error.message);
  });

  return child;
}

async function main() {
  try {
    // Step 1: Install dependencies
    console.log('📦 Installing dependencies...');
    await runCommand('npm', ['run', 'install:all'], '.', 'Install Dependencies');

    // Step 2: Build shared types
    console.log('🔧 Building shared types...');
    await runCommand('npm', ['run', 'build'], 'shared', 'Build Shared Types');

    // Step 3: Set up database
    console.log('🗄️  Setting up database...');
    try {
      await runCommand('node', ['setup-database.js'], 'backend', 'Database Setup');
    } catch (error) {
      console.log('⚠️  Database setup failed - this is normal if database already exists');
    }

    // Step 4: Build backend
    console.log('🔧 Building backend...');
    await runCommand('npm', ['run', 'build'], 'backend', 'Build Backend');

    // Step 5: Start backend server
    console.log('🖥️  Starting backend server...');
    const backendProcess = runServer('npm', ['run', 'dev'], 'backend', 'Backend Server');

    // Wait a moment for backend to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 6: Start frontend server
    console.log('🌐 Starting frontend server...');
    const frontendProcess = runServer('npm', ['run', 'dev'], 'frontend', 'Frontend Server');

    console.log('\n🎉 Development environment started!');
    console.log('📱 Frontend: http://localhost:5173');
    console.log('🔧 Backend: http://localhost:3000');
    console.log('📊 Health Check: http://localhost:3000/health');
    console.log('\n⏹️  Press Ctrl+C to stop all servers\n');

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down servers...');
      backendProcess.kill();
      frontendProcess.kill();
      process.exit(0);
    });

    // Keep the script running
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main();