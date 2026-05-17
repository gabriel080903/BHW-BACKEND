/**
 * Activity Logger Utility
 * Records user actions for audit trails and compliance
 */

const ActivityLog = require('../models/ActivityLog');

/**
 * Log user activity
 * @param {String} userId - ID of the user performing the action
 * @param {String} action - Type of action (CREATE_RESIDENT, UPDATE_RESIDENT, DELETE_RESIDENT, etc.)
 * @param {String} resourceType - Type of resource affected (Resident, Nutrition, BMI, etc.)
 * @param {String} resourceId - ID of the resource affected
 * @param {Object} changes - Details of what changed
 * @param {String} ipAddress - IP address of the request
 * @param {Object} userAgent - User agent information
 */
const logActivity = async (userId, action, resourceType, resourceId, changes = {}, ipAddress = '', userAgent = '') => {
  try {
    const log = new ActivityLog({
      userId,
      action,
      resourceType,
      resourceId,
      changes,
      ipAddress,
      userAgent,
      timestamp: new Date()
    });
    
    await log.save();
    return log;
  } catch (err) {
    // Log error but don't break the main operation
    console.error('Activity logging error:', err.message);
    return null;
  }
};

/**
 * Get activity logs with optional filters
 * @param {Object} filters - Filter criteria
 * @param {Number} limit - Maximum number of records to return
 * @param {Number} skip - Number of records to skip (pagination)
 */
const getActivityLogs = async (filters = {}, limit = 50, skip = 0) => {
  try {
    const logs = await ActivityLog.find(filters)
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip)
      .populate('userId', 'username role');
    
    return logs;
  } catch (err) {
    console.error('Error retrieving activity logs:', err.message);
    return [];
  }
};

module.exports = {
  logActivity,
  getActivityLogs
};
