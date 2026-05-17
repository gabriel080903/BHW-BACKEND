const MyFamily = require('../models/MyFamily');

const validateFamilyPayload = (data = {}) => {
	const missingFields = [];

	if (!data.firstName) missingFields.push('firstName');
	if (!data.middleName) missingFields.push('middleName');
	if (!data.lastName) missingFields.push('lastName');
	if (!data.birthDate) missingFields.push('birthDate');
	if (!data.gender) missingFields.push('gender');

	if (!data.address || typeof data.address !== 'object') {
		missingFields.push('address (object with purokZone and barangayPlace)');
	} else {
		if (!data.address.purokZone) missingFields.push('address.purokZone');
		if (!data.address.barangayPlace) missingFields.push('address.barangayPlace');
	}

	return missingFields;
};

exports.addMyFamilyMember = async (req, res) => {
	try {
		const missingFields = validateFamilyPayload(req.body);
		if (missingFields.length > 0) {
			return res.status(400).json({
				message: 'Validation Failed',
				error: `Missing required fields: ${missingFields.join(', ')}`
			});
		}

		const newMember = new MyFamily({
			firstName: req.body.firstName,
			middleName: req.body.middleName,
			lastName: req.body.lastName,
			birthDate: req.body.birthDate,
			gender: req.body.gender,
			address: {
				purokZone: req.body.address.purokZone,
				barangayPlace: req.body.address.barangayPlace
			},
			parentUser: req.user.id
		});

		const savedMember = await newMember.save();
		return res.status(201).json(savedMember);
	} catch (err) {
		return res.status(400).json({ message: 'Validation Failed', error: err.message });
	}
};

exports.getMyFamilyMembers = async (req, res) => {
	try {
		const members = await MyFamily.find({ parentUser: req.user.id }).sort({ createdAt: -1 });
		return res.status(200).json({ members });
	} catch (err) {
		return res.status(500).json({ message: 'Server Error', error: err.message });
	}
};
