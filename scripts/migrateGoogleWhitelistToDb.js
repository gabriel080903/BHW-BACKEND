#!/usr/bin/env node

/**
 * One-time migration script:
 * Moves GOOGLE_WHITELISTED_EMAILS from .env into MongoDB googlewhitelists collection.
 *
 * Usage:
 *   npm run migrate:google-whitelist
 *   npm run migrate:google-whitelist -- --dry-run
 */

const dotenv = require('dotenv');
const mongoose = require('mongoose');

const connectDB = require('../config/db');
const GoogleWhitelist = require('../models/GoogleWhitelist');
const { normalizeRole } = require('../utils/roles');

dotenv.config();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseWhitelist = (rawValue) => {
  return String(rawValue || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separatorIndex = entry.lastIndexOf(':');

      if (separatorIndex === -1) {
        return {
          raw: entry,
          valid: false,
          error: 'Missing role separator (:)',
        };
      }

      const email = entry.slice(0, separatorIndex).trim().toLowerCase();
      const roleRaw = entry.slice(separatorIndex + 1).trim();
      const role = normalizeRole(roleRaw);

      if (!EMAIL_REGEX.test(email)) {
        return {
          raw: entry,
          valid: false,
          error: 'Invalid email format',
        };
      }

      if (!role) {
        return {
          raw: entry,
          valid: false,
          error: 'Missing role',
        };
      }

      return {
        valid: true,
        email,
        role,
      };
    });
};

const main = async () => {
  const isDryRun = process.argv.includes('--dry-run');
  const rawWhitelist = process.env.GOOGLE_WHITELISTED_EMAILS;

  if (!rawWhitelist || !rawWhitelist.trim()) {
    console.log('No GOOGLE_WHITELISTED_EMAILS found in environment. Nothing to migrate.');
    process.exit(0);
  }

  const parsed = parseWhitelist(rawWhitelist);
  const validEntries = parsed.filter((entry) => entry.valid);
  const invalidEntries = parsed.filter((entry) => !entry.valid);

  if (invalidEntries.length) {
    console.log('Found invalid whitelist entries:');
    invalidEntries.forEach((entry) => {
      console.log(`- ${entry.raw}: ${entry.error}`);
    });
  }

  if (!validEntries.length) {
    console.log('No valid whitelist entries to migrate.');
    process.exit(1);
  }

  console.log(`Prepared ${validEntries.length} valid whitelist entries.`);
  validEntries.forEach((entry) => {
    console.log(`- ${entry.email} => ${entry.role}`);
  });

  if (isDryRun) {
    console.log('\nDry run complete. No database changes were made.');
    process.exit(0);
  }

  await connectDB();

  if (mongoose.connection.readyState !== 1) {
    console.error('Database is not connected. Set MONGO_URI and try again.');
    process.exit(1);
  }

  const operations = validEntries.map((entry) => ({
    updateOne: {
      filter: { email: entry.email },
      update: {
        $set: {
          role: entry.role,
          isActive: true,
        },
        $setOnInsert: {
          notes: 'Imported from GOOGLE_WHITELISTED_EMAILS migration',
        },
      },
      upsert: true,
    },
  }));

  const result = await GoogleWhitelist.bulkWrite(operations, { ordered: false });

  console.log('\nMigration complete.');
  console.log(`- Matched: ${result.matchedCount}`);
  console.log(`- Modified: ${result.modifiedCount}`);
  console.log(`- Upserted: ${result.upsertedCount}`);

  await mongoose.connection.close();
  process.exit(0);
};

main().catch(async (error) => {
  console.error('Migration failed:', error.message || error);

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }

  process.exit(1);
});
