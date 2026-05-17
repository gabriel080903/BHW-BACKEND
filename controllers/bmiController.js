const BMI = require('../models/bmi');
const Resident = require('../models/Resident');
const calculateBMI = require('../utils/bmiCalculator');

exports.createBMI = async (req, res) => {
  try {
    const { resident, weight, height } = req.body;

    if (!weight || !height) {
      return res.status(400).json({ error: 'Weight and height are required' });
    }

    if (req.user?.role === 'Parent/Guardian' && !resident) {
      return res.status(400).json({ error: 'resident is required for parent users' });
    }

    let residentDoc = null;
    if (resident) {
      residentDoc = await Resident.findById(resident).select('parentUser');
      if (!residentDoc) {
        return res.status(404).json({ error: 'Resident not found' });
      }
    }

    // Parent users can only create BMI records for their own resident records.
    if (req.user?.role === 'Parent/Guardian') {
      if (!residentDoc.parentUser || residentDoc.parentUser.toString() !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden: you can only manage your own child records' });
      }
    }

    // Use util to calculate BMI
    const { bmi, category } = calculateBMI(weight, height);

    // Save to DB
    const newBMI = new BMI({
      resident: resident || undefined,
      weight,
      height,
      bmi,
      category,
      recordedBy: req.user?.id
    });
    const savedBMI = await newBMI.save();

    res.status(201).json(savedBMI);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAllBMI = async (req, res) => {
  try {
    const query = {};

    // Parent users can only see BMI records for residents they own.
    if (req.user?.role === 'Parent/Guardian') {
      const ownedResidents = await Resident.find({ parentUser: req.user.id }).select('_id');
      const ownedResidentIds = ownedResidents.map((doc) => doc._id);

      if (ownedResidentIds.length === 0) {
        return res.status(200).json([]);
      }

      query.resident = { $in: ownedResidentIds };
    }

    const allBMI = await BMI.find(query).sort({ createdAt: -1 }); // latest first
    res.status(200).json(allBMI);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getResidentBMIHistory = async (req, res) => {
  try {
    const { residentId } = req.params;

    const residentDoc = await Resident.findById(residentId).select('parentUser');
    if (!residentDoc) {
      return res.status(404).json({ error: 'Resident not found' });
    }

    // Parent users can only access BMI history for their own resident records.
    if (req.user?.role === 'Parent/Guardian') {
      if (!residentDoc.parentUser || residentDoc.parentUser.toString() !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden: you can only access your own child records' });
      }
    }

    const records = await BMI.find({ resident: residentId }).sort({ createdAt: -1 });
    return res.status(200).json(records);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};