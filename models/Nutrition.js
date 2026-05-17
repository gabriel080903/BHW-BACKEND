const mongoose = require('mongoose');

const NutritionRecordSchema = new mongoose.Schema({
  resident: { type: mongoose.Schema.Types.ObjectId, ref: 'Resident', required: true },
  weight: { type: Number, required: true }, // in kg
  height: { type: Number, required: true }, // in cm
  bmi: Number,
  status: { 
    type: String, 
    enum: ['Underweight', 'Normal', 'Overweight', 'Obese'] 
  },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dateTaken: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NutritionRecord', NutritionRecordSchema);