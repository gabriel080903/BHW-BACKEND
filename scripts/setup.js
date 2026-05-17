#!/usr/bin/env node

/**
 * Setup Script for BHW Backend
 * Creates the initial admin user and performs database setup
 * 
 * Usage: npm run setup
 */

const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');

dotenv.config();

const User = require('../models/User');
const connectDB = require('../config/db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
};

const validatePassword = (password) => {
  const errors = [];

  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Must contain at least one special character (!@#$%^&*...)');
  }

  return { isValid: errors.length === 0, errors };
};

const main = async () => {
  try {
    console.log(`
╔════════════════════════════════════════════════════════╗
║    BHW Nutrition Tracker - Setup & Initialization      ║
╚════════════════════════════════════════════════════════╝
    `);

    // Connect to database
    console.log('📦 Connecting to database...');
    await connectDB();
    console.log('✓ Database connected\n');

    // Check if admin exists
    const adminCount = await User.countDocuments({ role: 'Admin' });
    if (adminCount > 0) {
      console.log('⚠️  Admin user already exists!');
      const proceed = await question('Continue with additional setup? (yes/no): ');
      if (proceed.toLowerCase() !== 'yes') {
        console.log('Setup cancelled.');
        process.exit(0);
      }
    }

    // Create admin user
    console.log('\n📝 Creating Admin User');
    console.log('────────────────────────────────────────────────────\n');

    let username = '';
    let validUsername = false;

    while (!validUsername) {
      username = await question('Enter admin username (3-30 characters, alphanumeric + underscore): ');

      if (username.length < 3 || username.length > 30) {
        console.log('❌ Username must be 3-30 characters long');
        continue;
      }

      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        console.log('❌ Username can only contain letters, numbers, and underscores');
        continue;
      }

      const existingUser = await User.findOne({ username });
      if (existingUser) {
        console.log('❌ Username already exists');
        continue;
      }

      validUsername = true;
    }

    console.log('\n🔐 Password Requirements:');
    console.log('   • Minimum 8 characters');
    console.log('   • At least one uppercase letter (A-Z)');
    console.log('   • At least one lowercase letter (a-z)');
    console.log('   • At least one number (0-9)');
    console.log('   • At least one special character (!@#$%...)');

    let password = '';
    let passwordValid = false;

    while (!passwordValid) {
      password = await question('\nEnter admin password: ');

      const validation = validatePassword(password);
      if (!validation.isValid) {
        console.log('\n❌ Password does not meet requirements:');
        validation.errors.forEach(err => console.log(`   • ${err}`));
        continue;
      }

      const confirmPassword = await question('Confirm password: ');
      if (password !== confirmPassword) {
        console.log('\n❌ Passwords do not match');
        continue;
      }

      passwordValid = true;
    }

    // Hash password
    console.log('\n🔒 Hashing password with 12 salt rounds...');
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create admin user
    const adminUser = new User({
      username,
      password: hashedPassword,
      role: 'Admin',
      isActive: true
    });

    await adminUser.save();

    console.log('\n✅ Admin user created successfully!');
    console.log(`
╔════════════════════════════════════════════════════════╗
║                   Setup Complete!                      ║
╠════════════════════════════════════════════════════════╣
║ Username: ${username.padEnd(40)}
║ Role: admin
║ Status: Active
╚════════════════════════════════════════════════════════╝

📌 Next Steps:
   1. Start the server: npm start
   2. Login at: POST /api/auth/login
   3. Use the credentials above
   4. Create additional BHW users via: POST /api/users

⚠️  Security Reminders:
   • Store credentials securely
   • Change password regularly
   • Enable HTTPS in production
   • Keep your .env file secure

    `);

    rl.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error during setup:', err.message);
    rl.close();
    process.exit(1);
  }
};

main();
