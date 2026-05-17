const Resident = require('../models/Resident');
const Nutrition = require('../models/Nutrition');

exports.getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const isParent = req.user?.role === 'Parent/Guardian';
    let residentFilter = {};
    let nutritionMatchFilter = {};

    if (isParent) {
      const ownedResidents = await Resident.find({ parentUser: req.user.id }).select('_id');
      const ownedResidentIds = ownedResidents.map((doc) => doc._id);

      if (ownedResidentIds.length === 0) {
        return res.json({
          totalResidents: 0,
          newResidentsThisMonth: 0,
          totalNutritionLogs: 0,
          nutritionStats: {
            normal: 0,
            underweight: 0,
            overweight: 0
          }
        });
      }

      residentFilter = { _id: { $in: ownedResidentIds } };
      nutritionMatchFilter = { resident: { $in: ownedResidentIds } };
    }

    // ---------------- TOTAL RESIDENTS ----------------
    const totalResidents = await Resident.countDocuments(residentFilter);

    // ---------------- NEW RESIDENTS THIS MONTH ----------------
    const newResidentsThisMonth = await Resident.countDocuments({
      ...residentFilter,
      createdAt: { $gte: firstDayOfMonth }
    });

    // ---------------- TOTAL NUTRITION LOGS ----------------
    const totalNutritionLogs = await Nutrition.countDocuments(nutritionMatchFilter);

    // ---------------- NUTRITION STATUS COUNTS ----------------
    const aggregationPipeline = [];
    if (Object.keys(nutritionMatchFilter).length > 0) {
      aggregationPipeline.push({ $match: nutritionMatchFilter });
    }
    aggregationPipeline.push({
      $group: {
        _id: "$status",
        count: { $sum: 1 }
      }
    });

    const nutritionAggregation = await Nutrition.aggregate(aggregationPipeline);

    const nutritionStats = {
      normal: 0,
      underweight: 0,
      overweight: 0
    };

    nutritionAggregation.forEach(item => {
      if (item._id === "Normal") nutritionStats.normal = item.count;
      if (item._id === "Underweight") nutritionStats.underweight = item.count;
      if (item._id === "Overweight") nutritionStats.overweight = item.count;
      if (item._id === "Obese") nutritionStats.overweight += item.count;
    });

    res.json({
      totalResidents,
      newResidentsThisMonth,
      totalNutritionLogs,
      nutritionStats
    });

  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};