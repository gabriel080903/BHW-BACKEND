const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  action: { 
    type: String, 
    required: true,
    enum: [
      'LOGIN',
      'LOGOUT',
      'CREATE_USER',
      'UPDATE_USER',
      'CREATE_RESIDENT',
      'UPDATE_RESIDENT',
      'DELETE_RESIDENT',
      'CREATE_NUTRITION',
      'UPDATE_NUTRITION',
      'DELETE_NUTRITION',
      'CREATE_BMI',
      'UPDATE_BMI',
      'DELETE_BMI',
      'CREATE_IMMUNIZATION',
      'UPDATE_IMMUNIZATION',
      'DELETE_IMMUNIZATION',
      'CREATE_INVENTORY',
      'UPDATE_INVENTORY',
      'DELETE_INVENTORY',
      'CREATE_REPORT',
      'UPDATE_REPORT',
      'VIEW_REPORT'
    ]
  },
  resourceType: { 
    type: String, 
    enum: ['Resident', 'Nutrition', 'BMI', 'Immunization', 'Inventory', 'Report', 'User'],
    required: true 
  },
  resourceId: { 
    type: String 
  },
  changes: { 
    type: mongoose.Schema.Types.Mixed,
    default: {} 
  },
  ipAddress: { 
    type: String 
  },
  userAgent: { 
    type: String 
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true
  }
}, { timestamps: false });

// Create index for efficient querying
ActivityLogSchema.index({ userId: 1, timestamp: -1 });
ActivityLogSchema.index({ resourceType: 1, resourceId: 1 });
ActivityLogSchema.index({ action: 1 });

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
