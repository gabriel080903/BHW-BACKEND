const Resident = require('../models/Resident');
const Nutrition = require('../models/Nutrition');
const BMI = require('../models/bmi');
const Vaccine = require('../models/Vaccine');
const { logActivity } = require('../utils/activityLogger');

// Helper function to validate required fields
const validateResident = (data = {}) => {
  const requiredFields = ['firstName', 'lastName', 'birthDate', 'gender'];
  const missingFields = requiredFields.filter((field) => !(field in data));

  return missingFields;
};

// Get all residents
exports.getAllResidents = async (req, res) => {
  try {
    const query = {};

    // Parent users can only view residents they own.
    if (req.user?.role === 'Parent/Guardian') {
      query.parentUser = req.user.id;
    }

    const residents = await Resident.find(query).sort({ createdAt: -1 });
    res.status(200).json({ residents });
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

// Add a new resident
exports.addResident = async (req, res) => {
  try {
    const missingFields = validateResident(req.body);
    if (missingFields.length > 0) {
      return res.status(400).json({
        message: 'Validation Failed',
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    const residentData = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      middleName: req.body.middleName || '',
      birthDate: req.body.birthDate,
      gender: req.body.gender,
      address: {
        purok: req.body.address?.purok || 1,
        street: req.body.address?.street || 'N/A'
      },
      contactNumber: req.body.contact || req.body.contactNumber || '',
      medicalConditions: req.body.medicalConditions || [],
      bloodType: req.body.bloodType || 'Unknown',
      medicalHistory: req.body.medicalHistory || '',
      allergies: Array.isArray(req.body.allergies)
        ? req.body.allergies
        : (req.body.allergies || '').split(',').map((s) => s.trim()).filter(Boolean),
      medications: Array.isArray(req.body.medications)
        ? req.body.medications
        : (req.body.medications || '').split(',').map((s) => s.trim()).filter(Boolean),
      emergencyContact: {
        name: req.body.emergencyName || '',
        number: req.body.emergencyContact || ''
      }
    };

    // Parent-created residents are automatically linked to that parent account.
    if (req.user?.role === 'Parent/Guardian') {
      residentData.parentUser = req.user.id;
    }

    const newResident = new Resident(residentData);
    await newResident.save();

    await logActivity(
      req.user?.id,
      'CREATE_RESIDENT',
      'Resident',
      newResident._id.toString(),
      { name: `${newResident.firstName} ${newResident.lastName}` },
      req.ip,
      req.get('user-agent')
    );

    res.status(201).json(newResident);
  } catch (err) {
    res.status(400).json({ message: 'Validation Failed', error: err.message });
  }
};

// Update resident
exports.updateResident = async (req, res) => {
  try {
    const { residentId } = req.params;
    const resident = await Resident.findById(residentId);
    if (!resident) {
      return res.status(404).json({ message: 'Resident not found' });
    }

    if (req.user?.role === 'Parent/Guardian') {
      if (!resident.parentUser || resident.parentUser.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: you can only manage your own child records' });
      }
    }

    const body = req.body || {};
    if (body.firstName !== undefined) resident.firstName = body.firstName;
    if (body.lastName !== undefined) resident.lastName = body.lastName;
    if (body.middleName !== undefined) resident.middleName = body.middleName;
    if (body.birthDate !== undefined) resident.birthDate = body.birthDate;
    if (body.gender !== undefined) resident.gender = body.gender;

    if (body.address && typeof body.address === 'object') {
      resident.address = {
        ...resident.address,
        ...body.address,
        purok: body.address.purok || resident.address?.purok || 1,
        street: body.address.street || resident.address?.street || 'N/A'
      };
    }

    if (body.contact !== undefined) resident.contactNumber = body.contact;
    if (body.contactNumber !== undefined) resident.contactNumber = body.contactNumber;
    if (body.bloodType !== undefined) resident.bloodType = body.bloodType;
    if (body.medicalHistory !== undefined) resident.medicalHistory = body.medicalHistory;

    if (body.allergies !== undefined) {
      resident.allergies = Array.isArray(body.allergies)
        ? body.allergies
        : String(body.allergies).split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (body.medications !== undefined) {
      resident.medications = Array.isArray(body.medications)
        ? body.medications
        : String(body.medications).split(',').map((s) => s.trim()).filter(Boolean);
    }

    if (body.emergencyName !== undefined || body.emergencyContact !== undefined) {
      resident.emergencyContact = {
        ...resident.emergencyContact,
        ...(body.emergencyName !== undefined ? { name: body.emergencyName } : {}),
        ...(body.emergencyContact !== undefined ? { number: body.emergencyContact } : {})
      };
    }

    await resident.save();

    await logActivity(
      req.user?.id,
      'UPDATE_RESIDENT',
      'Resident',
      resident._id.toString(),
      { name: `${resident.firstName} ${resident.lastName}` },
      req.ip,
      req.get('user-agent')
    );

    return res.status(200).json(resident);
  } catch (err) {
    return res.status(400).json({ message: 'Update failed', error: err.message });
  }
};

// Delete resident
exports.deleteResident = async (req, res) => {
  try {
    const { residentId } = req.params;
    const resident = await Resident.findById(residentId);
    if (!resident) {
      return res.status(404).json({ message: 'Resident not found' });
    }

    if (req.user?.role === 'Parent/Guardian') {
      if (!resident.parentUser || resident.parentUser.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: you can only manage your own child records' });
      }
    }

    await Promise.all([
      Nutrition.deleteMany({ resident: residentId }),
      BMI.deleteMany({ resident: residentId }),
      Vaccine.deleteMany({ resident: residentId })
    ]);

    await Resident.deleteOne({ _id: residentId });

    await logActivity(
      req.user?.id,
      'DELETE_RESIDENT',
      'Resident',
      residentId,
      { name: `${resident.firstName} ${resident.lastName}` },
      req.ip,
      req.get('user-agent')
    );

    return res.status(200).json({ message: 'Resident deleted successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Delete failed', error: err.message });
  }
};

// Get combined resident timeline (nutrition, BMI, and vaccines)
exports.getResidentTimeline = async (req, res) => {
  try {
    const { residentId } = req.params;

    const resident = await Resident.findById(residentId);
    if (!resident) {
      return res.status(404).json({ message: 'Resident not found' });
    }

    // Parent users can only view timeline data for their own resident records.
    if (req.user?.role === 'Parent/Guardian') {
      if (!resident.parentUser || resident.parentUser.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: you can only access your own child records' });
      }
    }

    const [nutritionRecords, bmiRecords, vaccineRecords] = await Promise.all([
      Nutrition.find({ resident: residentId }).lean(),
      BMI.find({ resident: residentId }).lean(),
      Vaccine.find({ resident: residentId }).lean()
    ]);

    const timeline = [
      ...nutritionRecords.map((record) => ({
        type: 'nutrition',
        date: record.dateTaken || record.createdAt,
        data: record
      })),
      ...bmiRecords.map((record) => ({
        type: 'bmi',
        date: record.createdAt,
        data: record
      })),
      ...vaccineRecords.map((record) => ({
        type: 'vaccine',
        date: record.dateAdministered || record.createdAt,
        data: record
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.status(200).json({
      resident,
      timeline
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server Error', error: err.message });
  }
};
