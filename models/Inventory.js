const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  category: { type: String },
  stockQty: { type: Number, default: 0 },
  unit: { type: String, default: 'pcs' },
  notes: { type: String, default: '' },
  expiryDate: { type: Date },
  status: { type: String, enum: ['In Stock', 'Low Stock', 'Out of Stock'], default: 'In Stock' }
}, { timestamps: true });

module.exports = mongoose.model('Inventory', InventorySchema);
