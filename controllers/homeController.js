const Resident = require('../models/Resident');
const Nutrition = require('../models/Nutrition');
const BMI = require('../models/bmi');
const Vaccine = require('../models/Vaccine');

const countByCategory = (rows, keyName, allowedKeys) => {
	const result = allowedKeys.reduce((acc, key) => {
		acc[key] = 0;
		return acc;
	}, {});

	rows.forEach((row) => {
		if (row && result[row._id] !== undefined) {
			result[row._id] = row[keyName];
		}
	});

	return result;
};

exports.getHomeData = async (req, res) => {
	try {
		const parentUserId = req.user?.id;

		const residents = await Resident.find({ parentUser: parentUserId }).select('_id');
		const residentIds = residents.map((resident) => resident._id);

		if (residentIds.length === 0) {
			return res.status(200).json({
				totals: {
					registered: 0,
					nutritionRecords: 0,
					bmiRecords: 0,
					vaccineRecords: 0
				},
				vaccinated: 0,
				bmiStats: {
					underweight: 0,
					normal: 0,
					overweight: 0,
					obese: 0
				},
				healthAlerts: {
					underweightResidents: 0,
					obeseResidents: 0,
					dueVaccines: 0
				}
			});
		}

		const residentFilter = { resident: { $in: residentIds } };

		const [nutritionRecords, bmiRecords, vaccineRecords, vaccinatedResidentIds, latestBmiAgg, latestNutritionAgg, dueVaccines] = await Promise.all([
			Nutrition.countDocuments(residentFilter),
			BMI.countDocuments(residentFilter),
			Vaccine.countDocuments(residentFilter),
			Vaccine.distinct('resident', { ...residentFilter, dateAdministered: { $exists: true, $ne: null } }),
			BMI.aggregate([
				{ $match: residentFilter },
				{ $sort: { createdAt: -1 } },
				{ $group: { _id: '$resident', category: { $first: '$category' } } },
				{ $group: { _id: '$category', count: { $sum: 1 } } }
			]),
			Nutrition.aggregate([
				{ $match: residentFilter },
				{ $sort: { dateTaken: -1 } },
				{ $group: { _id: '$resident', status: { $first: '$status' } } },
				{ $group: { _id: '$status', count: { $sum: 1 } } }
			]),
			Vaccine.countDocuments({
				...residentFilter,
				nextDueDate: { $lte: new Date() }
			})
		]);

		const bmiCategoryCounts = countByCategory(latestBmiAgg, 'count', ['Underweight', 'Normal', 'Overweight', 'Obese']);
		const nutritionStatusCounts = countByCategory(latestNutritionAgg, 'count', ['Underweight', 'Normal', 'Overweight', 'Obese']);

		return res.status(200).json({
			totals: {
				registered: residentIds.length,
				nutritionRecords,
				bmiRecords,
				vaccineRecords
			},
			vaccinated: vaccinatedResidentIds.length,
			bmiStats: {
				underweight: bmiCategoryCounts.Underweight,
				normal: bmiCategoryCounts.Normal,
				overweight: bmiCategoryCounts.Overweight,
				obese: bmiCategoryCounts.Obese
			},
			healthAlerts: {
				underweightResidents: nutritionStatusCounts.Underweight,
				obeseResidents: nutritionStatusCounts.Obese,
				dueVaccines
			}
		});
	} catch (err) {
		return res.status(500).json({ message: 'Server Error', error: err.message });
	}
};
