const Nutrition = require('../models/Nutrition');
const Resident = require('../models/Resident');
const calculateBMI = require('../utils/bmiCalculator');
const { isDbConnected } = require('../utils/dbCheck');
const { logActivity } = require('../utils/activityLogger');

exports.addNutritionRecord = async (req, res) => {
  try {
    const { resident, weight, height } = req.body;

    // Validate input
    if (!resident || !weight || !height) {
      return res.status(400).json({ message: 'resident, weight, and height are required' });
    }

    const residentDoc = await Resident.findById(resident).select('parentUser');
    if (!residentDoc) {
      return res.status(404).json({ message: 'Resident not found' });
    }

    // Parent users can only create nutrition records for their own resident records.
    if (req.user?.role === 'Parent/Guardian') {
      if (!residentDoc.parentUser || residentDoc.parentUser.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: you can only manage your own child records' });
      }
    }

    // Calculate BMI (height should be in cm)
    const { bmi, category } = calculateBMI(weight, height);

    const newRecord = new Nutrition({
      resident,
      weight,
      height,
      bmi,
      status: category,
      recordedBy: req.user?.id   // set from authenticated user
    });

    await newRecord.save();

    // Log the activity
    await logActivity(
      req.user?.id,
      'CREATE_NUTRITION',
      'Nutrition',
      newRecord._id.toString(),
      { resident, weight, height, bmi, status: category },
      req.ip,
      req.get('user-agent')
    );

    res.status(201).json(newRecord);
  } catch (err) {
    console.error('Nutrition record error:', err);
    res.status(400).json({ message: "Error saving record", error: err.message });
  }
};

exports.getResidentNutritionHistory = async (req, res) => {
  try {
    const { residentId } = req.params;

    const residentDoc = await Resident.findById(residentId).select('parentUser');
    if (!residentDoc) {
      return res.status(404).json({ message: 'Resident not found' });
    }

    // Parent users can only access nutrition history for their own resident records.
    if (req.user?.role === 'Parent/Guardian') {
      if (!residentDoc.parentUser || residentDoc.parentUser.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: you can only access your own child records' });
      }
    }

    const records = await Nutrition.find({ resident: residentId })
      .sort({ dateTaken: -1 });

    return res.status(200).json(records);
  } catch (err) {
    return res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

exports.getAllNutritionRecords = async (req, res) => {
  try {
    const query = {};

    // Parent users can only view records for their own residents.
    if (req.user?.role === 'Parent/Guardian') {
      const ownedResidents = await Resident.find({ parentUser: req.user.id }).select('_id');
      query.resident = { $in: ownedResidents.map((r) => r._id) };
    }

    const records = await Nutrition.find(query).sort({ dateTaken: -1 });
    return res.status(200).json(records);
  } catch (err) {
    return res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

exports.updateNutritionRecord = async (req, res) => {
  try {
    const { recordId } = req.params;
    const record = await Nutrition.findById(recordId);
    if (!record) {
      return res.status(404).json({ message: 'Nutrition record not found' });
    }

    const residentDoc = await Resident.findById(record.resident).select('parentUser');
    if (!residentDoc) {
      return res.status(404).json({ message: 'Resident not found' });
    }

    if (req.user?.role === 'Parent/Guardian') {
      if (!residentDoc.parentUser || residentDoc.parentUser.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: you can only manage your own child records' });
      }
    }

    const nextWeight = req.body.weight !== undefined ? Number(req.body.weight) : Number(record.weight);
    const nextHeight = req.body.height !== undefined ? Number(req.body.height) : Number(record.height);

    if (!nextWeight || !nextHeight) {
      return res.status(400).json({ message: 'weight and height are required' });
    }

    const { bmi, category } = calculateBMI(nextWeight, nextHeight);

    record.weight = nextWeight;
    record.height = nextHeight;
    record.bmi = bmi;
    record.status = category;
    if (req.body.dateTaken) record.dateTaken = req.body.dateTaken;

    await record.save();

    await logActivity(
      req.user?.id,
      'UPDATE_NUTRITION',
      'Nutrition',
      record._id.toString(),
      { resident: String(record.resident), weight: record.weight, height: record.height, bmi: record.bmi, status: record.status },
      req.ip,
      req.get('user-agent')
    );

    return res.status(200).json(record);
  } catch (err) {
    return res.status(400).json({ message: 'Error updating record', error: err.message });
  }
};

exports.deleteNutritionRecord = async (req, res) => {
  try {
    const { recordId } = req.params;
    const record = await Nutrition.findById(recordId);
    if (!record) {
      return res.status(404).json({ message: 'Nutrition record not found' });
    }

    const residentDoc = await Resident.findById(record.resident).select('parentUser');
    if (!residentDoc) {
      return res.status(404).json({ message: 'Resident not found' });
    }

    if (req.user?.role === 'Parent/Guardian') {
      if (!residentDoc.parentUser || residentDoc.parentUser.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: you can only manage your own child records' });
      }
    }

    await Nutrition.deleteOne({ _id: recordId });

    await logActivity(
      req.user?.id,
      'DELETE_NUTRITION',
      'Nutrition',
      recordId,
      { resident: String(record.resident) },
      req.ip,
      req.get('user-agent')
    );

    return res.status(200).json({ message: 'Nutrition record deleted successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Error deleting record', error: err.message });
  }
};
