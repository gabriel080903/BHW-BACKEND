const path = require('path');
const fs = require('fs');
const { importMonthlyReport } = require('../controllers/monthly_reportController');

async function run() {
  const filePath = path.join(__dirname, '..', 'tmp', 'sample_import.xlsx');
  if (!fs.existsSync(filePath)) {
    console.error('Create tmp/sample_import.xlsx with a sheet containing columns: residentId,date,weight,height');
    process.exit(1);
  }
  const buffer = fs.readFileSync(filePath);

  const req = { file: { originalname: 'sample_import.xlsx', buffer }, body: { confirm: 'true' } };
  const res = {
    status(code) { this.code = code; return this; },
    json(obj) { console.log('STATUS', this.code || 200); console.log(JSON.stringify(obj, null, 2)); }
  };

  await importMonthlyReport(req, res);
}

run().catch(err => console.error(err));
