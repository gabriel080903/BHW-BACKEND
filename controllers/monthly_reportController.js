const Resident = require('../models/Resident');
const Nutrition = require('../models/Nutrition');
const Vaccine = require('../models/Vaccine');
const Inventory = require('../models/Inventory');
const { isDbConnected } = require('../utils/dbCheck');
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const xlsx = require('xlsx');

exports.getMonthlyReport = async (req, res) => {
    try {
        const now = new Date();
        const month = now.toLocaleString('default', { month: 'long', year: 'numeric' });

        // Fallback sample when DB not connected
        if (!isDbConnected()) {
            return res.status(200).json({
                success: true,
                report: {
                    totalResidents: 1,
                    nutritionLogs: 5,
                    normalBMI: 3,
                    vaccinated: 1,
                    vaccinationCoverage: '100.0',
                    lowStockItems: 0,
                    month
                }
            });
        }

        const totalResidents = await Resident.countDocuments();
        const nutritionLogs = await Nutrition.countDocuments();
        const normalBMI = await Nutrition.countDocuments({ status: 'Normal' });

        // Count vaccine records that have a dateAdministered (i.e. actually given)
        const vaccinated = await Vaccine.countDocuments({ dateAdministered: { $exists: true, $ne: null } });

        const coverage = totalResidents > 0 ? (vaccinated / totalResidents) * 100 : 0;
        const lowStockItems = await Inventory.countDocuments({ status: 'Low Stock' });

        res.status(200).json({
            success: true,
            report: {
                totalResidents,
                nutritionLogs,
                normalBMI,
                vaccinated,
                vaccinationCoverage: coverage.toFixed(1),
                lowStockItems,
                month
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};


// new this month, medical cases

exports.importMonthlyReport = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

        const originalName = req.file.originalname || '';
        const ext = path.extname(originalName).toLowerCase();
        const confirm = String(req.body.confirm || '').toLowerCase() === 'true';
        const dryRun = !confirm; // default to dry-run unless confirm=true

        // Helper: map spreadsheet rows to Nutrition docs
        const mapRowsToNutrition = (rows) => {
            const docs = [];
            const errors = [];
            rows.forEach((r, idx) => {
                // Accept multiple column name variants
                const residentId = r.residentId || r.resident_id || r.id || r.resident || null;
                const date = r.date || r.timestamp || r.datetime || null;
                const weight = r.weight || r.wt || r.kg || null;
                const height = r.height || r.ht || null;
                const status = r.status || null;

                if (!residentId) {
                    errors.push({ row: idx + 1, error: 'missing residentId' });
                    return;
                }

                const doc = {
                    residentId: String(residentId),
                    date: date ? new Date(date) : new Date(),
                    weight: weight != null ? Number(weight) : null,
                    height: height != null ? Number(height) : null,
                    status: status || undefined,
                };
                docs.push(doc);
            });
            return { docs, errors };
        };

        if (ext === '.txt') {
            const text = req.file.buffer.toString('utf8');
            if (!confirm) return res.status(200).json({ success: true, file: originalName, parsed: { type: 'text', preview: text.slice(0, 1000) } });
            // For safety, do not auto-import free text
            return res.status(400).json({ success: false, error: 'Confirm import for .txt is not supported. Convert to structured CSV/XLSX.' });
        }

        if (ext === '.docx') {
            const { value } = await mammoth.extractRawText({ buffer: req.file.buffer });
            if (!confirm) return res.status(200).json({ success: true, file: originalName, parsed: { type: 'docx', preview: value.slice(0, 1000) } });
            return res.status(400).json({ success: false, error: 'Confirm import for .docx is not supported. Convert to structured CSV/XLSX.' });
        }

        if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
            const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
            const sheets = {};
            const summary = [];

            for (const name of wb.SheetNames) {
                const sheet = wb.Sheets[name];
                const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });
                sheets[name] = rows.slice(0, 10);

                // Map rows to Nutrition docs for dry-run/confirm
                const { docs, errors } = mapRowsToNutrition(rows);
                summary.push({ sheet: name, rows: rows.length, valid: docs.length, errors: errors.length, sample: docs.slice(0, 5) });
            }

            if (dryRun) {
                return res.status(200).json({ success: true, file: originalName, parsed: { type: 'spreadsheet', sheets }, summary });
            }

            // Confirm: persist to DB
            if (!isDbConnected()) return res.status(503).json({ success: false, error: 'Database not connected' });

            // Aggregate docs across sheets and insert into Nutrition
            const allDocs = [];
            for (const name of wb.SheetNames) {
                const sheet = wb.Sheets[name];
                const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });
                const { docs, errors } = mapRowsToNutrition(rows);
                allDocs.push(...docs.map(d => ({ ...d })));
            }

            // Basic insert (ordered:false to continue on errors)
            try {
                const inserted = await Nutrition.insertMany(allDocs, { ordered: false });
                return res.status(200).json({ success: true, file: originalName, inserted: inserted.length });
            } catch (insertErr) {
                // mongoose BulkWriteError may contain insertedCount
                const insertedCount = (insertErr && insertErr.result && insertErr.result.nInserted) || 0;
                return res.status(500).json({ success: false, error: insertErr.message, inserted: insertedCount });
            }
        }

        return res.status(400).json({ success: false, error: 'Unsupported file type' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};