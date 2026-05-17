const mongoose = require('mongoose');

const ResidentSchema = new mongoose.Schema({
  firstName:  { type: String, required: true },
  lastName:   { type: String, required: true },
  middleName: { type: String, default: '' },
  birthDate:  { type: Date,   required: true },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],  
    required: true
  },
  age: { type: Number },

  address: {
    purok:  { type: Number, default: 1 },
    street: { type: String, default: 'N/A' }
  },

  
  contactNumber: { type: String },


  medicalConditions: { type: [String], default: [] },

  // ── NEW FIELDS 
  bloodType: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'],
    default: 'Unknown'
  },
  medicalHistory: { type: String, default: '' },
  allergies:      { type: [String], default: [] },
  medications:    { type: [String], default: [] },
  emergencyContact: {
    name:   { type: String, default: '' },
    number: { type: String, default: '' }
  },
  // ── END NEW FIELDS ──

  parentUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  children: [{
    firstName:  { type: String, required: true },
    lastName:   { type: String, required: true },
    middleName: { type: String, required: true },
    birthDate:  { type: Date,   required: true },
    age:        { type: Number }
  }]
}, { timestamps: true });

// Calculate age from birthdate before saving
ResidentSchema.pre('save', function() {
  if (this.birthDate) {
    const today     = new Date();
    const birthDate = new Date(this.birthDate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    this.age = age;
  }

  if (this.children && this.children.length > 0) {
    this.children.forEach(child => {
      if (child.birthDate) {
        const today     = new Date();
        const birthDate = new Date(child.birthDate);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        child.age = age;
      }
    });
  }

});

module.exports = mongoose.model('Resident', ResidentSchema);
