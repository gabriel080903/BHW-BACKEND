/**
 * Seed Script — creates default Admin, BHW Staff, and Parent accounts
 * Run once: node scripts/seedUsers.js
 * 
 * CHANGE THE PASSWORDS after first login!
 */
const dotenv = require('dotenv')
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
dotenv.config()

const connectDB = require('../config/db')
const User = require('../models/User')

const DEFAULT_USERS = [
  { username: 'admin',    password: 'Admin@2026!',  role: 'Admin'           },
  { username: 'bhwstaff', password: 'Staff@2026!',  role: 'BHW'             },
  { username: 'parent',   password: 'Parent@2026!', role: 'Parent/Guardian' },
]

async function seed() {
  await connectDB()
  console.log('\n🌱 Seeding default users...\n')

  for (const u of DEFAULT_USERS) {
    const exists = await User.findOne({ username: u.username })
    if (exists) {
      console.log(`  ⚠️  "${u.username}" already exists — skipped`)
      continue
    }
    const hashed = await bcrypt.hash(u.password, 12)
    await User.create({ username: u.username, password: hashed, role: u.role, isActive: true })
    console.log(`  ✅ Created "${u.username}" (${u.role}) — password: ${u.password}`)
  }

  console.log('\n⚠️  IMPORTANT: Change all passwords after first login!\n')
  await mongoose.disconnect()
  process.exit(0)
}

seed().catch(err => {
  console.error('Seed error:', err.message)
  process.exit(1)
})
