#!/usr/bin/env node

/**
 * One-time script to backfill Resident.parentUser.
 *
 * Usage:
 *   npm run backfill:resident-parent -- <mapping-file> [--dry-run] [--force]
 *
 * Mapping file format (JSON array):
 * [
 *   { "residentId": "<resident_object_id>", "parentUserId": "<user_object_id>" }
 * ]
 *
 * Flags:
 *   --dry-run  Preview updates without writing changes
 *   --force    Overwrite existing parentUser values
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = require('../config/db');
const Resident = require('../models/Resident');
const User = require('../models/User');
const { ROLE_PARENT_GUARDIAN, normalizeRole } = require('../utils/roles');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const mappingArg = args.find((arg) => !arg.startsWith('--'));

if (!mappingArg) {
  console.error('Missing mapping file path.');
  console.error('Usage: npm run backfill:resident-parent -- <mapping-file> [--dry-run] [--force]');
  process.exit(1);
}

const mappingPath = path.isAbsolute(mappingArg)
  ? mappingArg
  : path.resolve(process.cwd(), mappingArg);

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const loadMappings = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Mapping file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('Mapping file must be a JSON array');
  }

  return parsed;
};

const main = async () => {
  let updated = 0;
  let skipped = 0;
  let invalid = 0;

  try {
    const mappings = loadMappings(mappingPath);

    await connectDB();

    for (const [index, entry] of mappings.entries()) {
      const residentId = entry && entry.residentId;
      const parentUserId = entry && entry.parentUserId;

      if (!isValidObjectId(residentId) || !isValidObjectId(parentUserId)) {
        invalid += 1;
        console.warn(`Skipping entry ${index}: invalid residentId or parentUserId`);
        continue;
      }

      const [resident, parentUser] = await Promise.all([
        Resident.findById(residentId).select('_id parentUser'),
        User.findById(parentUserId).select('_id role')
      ]);

      if (!resident) {
        invalid += 1;
        console.warn(`Skipping entry ${index}: resident not found (${residentId})`);
        continue;
      }

      if (!parentUser) {
        invalid += 1;
        console.warn(`Skipping entry ${index}: user not found (${parentUserId})`);
        continue;
      }

      if (normalizeRole(parentUser.role) !== ROLE_PARENT_GUARDIAN) {
        invalid += 1;
        console.warn(`Skipping entry ${index}: user is not a parent (${parentUserId})`);
        continue;
      }

      if (resident.parentUser && !force) {
        skipped += 1;
        continue;
      }

      if (!dryRun) {
        resident.parentUser = parentUserId;
        await resident.save();
      }

      updated += 1;
    }

    console.log('Backfill complete');
    console.log(`Updated: ${updated}`);
    console.log(`Skipped (already set): ${skipped}`);
    console.log(`Invalid entries: ${invalid}`);
    console.log(`Mode: ${dryRun ? 'dry-run' : 'write'}`);
    console.log(`Force overwrite: ${force ? 'yes' : 'no'}`);
  } catch (error) {
    console.error('Backfill failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

main();
