const Inventory = require('../models/Inventory');
const { isDbConnected } = require('../utils/dbCheck');

const SAMPLE_ITEMS = [
  { _id: 'inv-1', itemName: 'Paracetamol', category: 'Medicine', stockQty: 20, unit: 'pcs', notes: '', expiryDate: null, status: 'In Stock' }
];

// Add new item to stock
exports.addItem = async (req, res) => {
  try {
    if (!isDbConnected()) {
      const created = Object.assign({ _id: `sample-${Date.now()}` }, req.body);
      return res.status(201).json({ success: true, data: created });
    }

    const { itemName, category, stockQty, unit, notes, expiryDate } = req.body;

    // Determine status based on quantity
    let status = 'In Stock';
    if (stockQty <= 0) status = 'Out of Stock';
    else if (stockQty < 10) status = 'Low Stock';

    const newItem = new Inventory({ itemName, category, stockQty, unit, notes, expiryDate, status });
    await newItem.save();
    res.status(201).json({ success: true, data: newItem });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// Get all items for the Inventory list
exports.getInventory = async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(200).json({ success: true, data: SAMPLE_ITEMS });
    const items = await Inventory.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// Update inventory item
exports.updateItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!isDbConnected()) {
      return res.status(200).json({ success: true, data: { _id: itemId, ...req.body } });
    }

    const item = await Inventory.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    if (req.body.itemName !== undefined) item.itemName = req.body.itemName;
    if (req.body.category !== undefined) item.category = req.body.category;
    if (req.body.stockQty !== undefined) item.stockQty = Number(req.body.stockQty);
    if (req.body.expiryDate !== undefined) item.expiryDate = req.body.expiryDate || null;
    if (req.body.unit !== undefined) item.unit = req.body.unit;
    if (req.body.notes !== undefined) item.notes = req.body.notes;

    if (item.stockQty <= 0) item.status = 'Out of Stock';
    else if (item.stockQty < 10) item.status = 'Low Stock';
    else item.status = 'In Stock';

    await item.save();
    return res.status(200).json({ success: true, data: item });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

// Delete inventory item
exports.deleteItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!isDbConnected()) {
      return res.status(200).json({ success: true, message: 'Item deleted' });
    }

    const deleted = await Inventory.findByIdAndDelete(itemId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    return res.status(200).json({ success: true, message: 'Item deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
