function calculateBMI(weight, height) {
  if (!weight || !height) throw new Error('Weight and height are required');

  // Convert height from cm to meters
  const heightInMeters = height / 100;
  const bmi = weight / (heightInMeters * heightInMeters);
  let category = '';

  if (bmi < 18.5) category = 'Underweight';
  else if (bmi < 25) category = 'Normal';
  else if (bmi < 30) category = 'Overweight';
  else category = 'Obese';

  return {
    bmi: parseFloat(bmi.toFixed(2)),
    category
  };
}

module.exports = calculateBMI;