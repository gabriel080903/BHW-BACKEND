const Vaccine = require('../models/Vaccine');
const Resident = require('../models/Resident');
const { isDbConnected } = require('../utils/dbCheck');

const SAMPLE_VACCINE = {
    _id: 'sample-vaccine-1',
    resident: 'sample-resident-1',
    vaccineName: 'BCG',
    doseNumber: 1,
    dateAdministered: new Date(),
    remarks: 'Sample'
};

// @desc    Add a new vaccine record
// @route   POST /api/vaccines
exports.addVaccine = async (req, res) => {
    try {
        if (!isDbConnected()) {
            const created = Object.assign({ _id: `sample-${Date.now()}` }, req.body);
            return res.status(201).json(created);
        }

        const { resident, vaccineName, doseNumber, dateAdministered, administeredBy, nextDueDate, remarks } = req.body;

        const newRecord = new Vaccine({ resident, vaccineName, doseNumber, dateAdministered, administeredBy, nextDueDate, remarks });
        const savedRecord = await newRecord.save();
        await savedRecord.populate('resident', 'firstName lastName contactNumber medicalConditions');
        res.status(201).json(savedRecord);
    } catch (err) {
        res.status(400).json({ message: 'Failed to add record', error: err.message });
    }
};

// @desc    Get all vaccine records for one resident
// @route   GET /api/vaccines/:residentId
exports.getResidentVaccineHistory = async (req, res) => {
    try {
        if (!isDbConnected()) return res.status(200).json([SAMPLE_VACCINE]);

        // Parent users can only access vaccine history of their own resident records.
        if (req.user?.role === 'Parent/Guardian') {
            const resident = await Resident.findById(req.params.residentId).select('parentUser');

            if (!resident) {
                return res.status(404).json({ message: 'Resident not found' });
            }

            if (!resident.parentUser || resident.parentUser.toString() !== req.user.id) {
                return res.status(403).json({ message: 'Forbidden: you can only access your own child records' });
            }
        }

        const history = await Vaccine.find({ resident: req.params.residentId })
            .populate('resident', 'firstName lastName contactNumber medicalConditions') // Includes contact and medical info
            .sort({ dateAdministered: -1 });

        res.status(200).json(history);
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// @desc    Replace vaccine list for one resident
// @route   PUT /api/vaccines/:residentId
exports.replaceResidentVaccines = async (req, res) => {
    try {
        const { residentId } = req.params;
        const vaccines = Array.isArray(req.body?.vaccines) ? req.body.vaccines : [];

        if (!isDbConnected()) {
            return res.status(200).json(vaccines.map((v, i) => ({
                _id: `sample-vax-${Date.now()}-${i}`,
                resident: residentId,
                vaccineName: v.name || 'Other',
                doseNumber: Number(v.doseNumber || i + 1),
                dateAdministered: v.date || new Date().toISOString(),
                remarks: v.remarks || ''
            })));
        }

        const resident = await Resident.findById(residentId).select('parentUser');
        if (!resident) {
            return res.status(404).json({ message: 'Resident not found' });
        }

        if (req.user?.role === 'Parent/Guardian') {
            if (!resident.parentUser || resident.parentUser.toString() !== req.user.id) {
                return res.status(403).json({ message: 'Forbidden: you can only manage your own child records' });
            }
        }

        await Vaccine.deleteMany({ resident: residentId });

        const docs = vaccines.map((v, index) => ({
            resident: residentId,
            vaccineName: v.name || 'Other',
            doseNumber: Number(v.doseNumber || index + 1),
            dateAdministered: v.date || new Date(),
            administeredBy: v.administeredBy || '',
            remarks: v.remarks || ''
        }));

        const created = docs.length > 0 ? await Vaccine.insertMany(docs) : [];
        return res.status(200).json(created);
    } catch (err) {
        return res.status(400).json({ message: 'Failed to replace vaccine records', error: err.message });
    }
};