const mongoose = require('mongoose');

const MyFamilySchema = new mongoose.Schema({
	firstName: { type: String, required: true, trim: true },
	middleName: { type: String, required: true, trim: true },
	lastName: { type: String, required: true, trim: true },
	birthDate: { type: Date, required: true },
	gender: { type: String, enum: ['Female', 'Male', 'Other'], required: true },
	address: {
		purokZone: { type: String, required: true, trim: true },
		barangayPlace: { type: String, required: true, trim: true }
	},
	parentUser: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
		index: true
	}
}, { timestamps: true });

module.exports = mongoose.model('MyFamily', MyFamilySchema);
