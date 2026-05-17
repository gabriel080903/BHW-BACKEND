const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  month: { type: String, required: true },
  totals: { type: Object, default: {} },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Report', ReportSchema);
