const mongoose = require('mongoose');

const VaccineSchema = new mongoose.Schema({
  resident: { type: mongoose.Schema.Types.ObjectId, ref: 'Resident', required: true },
  vaccineName: {
    type: String,
    enum: [
      // Core Philippine EPI vaccines (original)
      'BCG', 'HepB', 'Pentavalent', 'OPV', 'IPV', 'PCV', 'MMR',
      // Additional vaccines frontend allows via dropdown or Custom input
      'Measles', 'Varicella', 'Rotavirus', 'Influenza',
      'COVID-19', 'Tetanus', 'Typhoid', 'Rabies',
      'Meningococcal', 'HPV',
      // Catch-all for anything typed in the Custom field
      'Other'
    ],
    required: true
  },
  doseNumber:       { type: Number, required: true },
  dateAdministered: { type: Date, default: Date.now },
  administeredBy:   { type: String },
  nextDueDate:      { type: Date },
  remarks:          { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Vaccine', VaccineSchema);