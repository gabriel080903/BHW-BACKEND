const mongoose = require('mongoose');
const GoogleWhitelist = require('../models/GoogleWhitelist');
const { ROLE_VALUES, ROLE_DEFAULT, normalizeRole } = require('../utils/roles');
const { logActivity } = require('../utils/activityLogger');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const validateRole = (value) => {
  const normalized = normalizeRole(value || ROLE_DEFAULT);
  return ROLE_VALUES.includes(normalized) ? normalized : null;
};

const toResponse = (entry) => ({
  id: String(entry._id),
  email: entry.email,
  role: entry.role,
  isActive: entry.isActive,
  notes: entry.notes || '',
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
});

const listWhitelist = async (req, res) => {
  try {
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    const emailQuery = normalizeEmail(req.query.email || '');

    const filter = {};
    if (!includeInactive) filter.isActive = true;
    if (emailQuery) filter.email = emailQuery;

    const entries = await GoogleWhitelist.find(filter)
      .sort({ email: 1 })
      .lean();

    return res.status(200).json({
      entries: entries.map((entry) => ({
        id: String(entry._id),
        email: entry.email,
        role: entry.role,
        isActive: entry.isActive,
        notes: entry.notes || '',
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      })),
    });
  } catch (error) {
    console.error('List whitelist error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const createWhitelistEntry = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const role = validateRole(req.body?.role);
    const notes = req.body?.notes ? String(req.body.notes).trim() : '';

    if (!email) return res.status(400).json({ message: 'email is required' });
    if (!EMAIL_REGEX.test(email)) return res.status(400).json({ message: 'Invalid email format' });
    if (!role) return res.status(400).json({ message: `Invalid role. Allowed: ${ROLE_VALUES.join(', ')}` });

    const existing = await GoogleWhitelist.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Whitelist entry already exists for this email' });
    }

    const entry = new GoogleWhitelist({
      email,
      role,
      isActive: true,
      notes,
    });

    await entry.save();

    logActivity(
      req.user?.id || req.user?._id,
      'UPDATE_USER',
      'User',
      String(entry._id),
      { action: 'create_google_whitelist_entry', email, role },
      req.ip,
      req.get('user-agent')
    ).catch(() => {});

    return res.status(201).json({
      message: 'Whitelist entry created successfully',
      entry: toResponse(entry),
    });
  } catch (error) {
    console.error('Create whitelist entry error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const updateWhitelistEntry = async (req, res) => {
  try {
    const { entryId } = req.params;
    if (!isValidObjectId(entryId)) return res.status(400).json({ message: 'Invalid entryId' });

    const entry = await GoogleWhitelist.findById(entryId);
    if (!entry) return res.status(404).json({ message: 'Whitelist entry not found' });

    const nextEmail = req.body?.email !== undefined ? normalizeEmail(req.body.email) : entry.email;
    const nextRole = req.body?.role !== undefined ? validateRole(req.body.role) : entry.role;
    const nextNotes = req.body?.notes !== undefined ? String(req.body.notes || '').trim() : entry.notes;

    if (!EMAIL_REGEX.test(nextEmail)) return res.status(400).json({ message: 'Invalid email format' });
    if (!nextRole) return res.status(400).json({ message: `Invalid role. Allowed: ${ROLE_VALUES.join(', ')}` });

    if (nextEmail !== entry.email) {
      const emailTaken = await GoogleWhitelist.findOne({ email: nextEmail, _id: { $ne: entry._id } });
      if (emailTaken) {
        return res.status(409).json({ message: 'Another whitelist entry already uses this email' });
      }
    }

    entry.email = nextEmail;
    entry.role = nextRole;
    entry.notes = nextNotes;

    await entry.save();

    logActivity(
      req.user?.id || req.user?._id,
      'UPDATE_USER',
      'User',
      String(entry._id),
      { action: 'update_google_whitelist_entry', email: entry.email, role: entry.role },
      req.ip,
      req.get('user-agent')
    ).catch(() => {});

    return res.status(200).json({
      message: 'Whitelist entry updated successfully',
      entry: toResponse(entry),
    });
  } catch (error) {
    console.error('Update whitelist entry error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const deactivateWhitelistEntry = async (req, res) => {
  try {
    const { entryId } = req.params;
    if (!isValidObjectId(entryId)) return res.status(400).json({ message: 'Invalid entryId' });

    const entry = await GoogleWhitelist.findById(entryId);
    if (!entry) return res.status(404).json({ message: 'Whitelist entry not found' });

    entry.isActive = false;
    await entry.save();

    logActivity(
      req.user?.id || req.user?._id,
      'UPDATE_USER',
      'User',
      String(entry._id),
      { action: 'deactivate_google_whitelist_entry', email: entry.email },
      req.ip,
      req.get('user-agent')
    ).catch(() => {});

    return res.status(200).json({ message: 'Whitelist entry deactivated successfully' });
  } catch (error) {
    console.error('Deactivate whitelist entry error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const reactivateWhitelistEntry = async (req, res) => {
  try {
    const { entryId } = req.params;
    if (!isValidObjectId(entryId)) return res.status(400).json({ message: 'Invalid entryId' });

    const entry = await GoogleWhitelist.findById(entryId);
    if (!entry) return res.status(404).json({ message: 'Whitelist entry not found' });

    entry.isActive = true;
    await entry.save();

    logActivity(
      req.user?.id || req.user?._id,
      'UPDATE_USER',
      'User',
      String(entry._id),
      { action: 'reactivate_google_whitelist_entry', email: entry.email },
      req.ip,
      req.get('user-agent')
    ).catch(() => {});

    return res.status(200).json({ message: 'Whitelist entry reactivated successfully' });
  } catch (error) {
    console.error('Reactivate whitelist entry error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  listWhitelist,
  createWhitelistEntry,
  updateWhitelistEntry,
  deactivateWhitelistEntry,
  reactivateWhitelistEntry,
};
