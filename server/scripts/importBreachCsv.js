#!/usr/bin/env node
/**
 * CSV Breach Data Importer
 * 
 * Imports CSV-based datasets (utility/telecom subscriber records) into
 * the breaches collection with full row storage.
 * 
 * Usage:
 *   node scripts/importBreachCsv.js <csv-path> <breach-name> [--limit=N]
 * 
 * Example:
 *   node scripts/importBreachCsv.js data/uppcl_db.csv UPPCL_Power_Meerut --limit=1000
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const { Breach } = require('../models/breachDetails');

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/CDR_Visualizer';

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('Usage: node scripts/importBreachCsv.js <csv-path> <breach-name> [--limit=N]');
    console.error('Example: node scripts/importBreachCsv.js uppcl_db.csv UPPCL_Power_Meerut --limit=1000');
    process.exit(1);
}

const csvPath = args[0];
const breachName = args[1];
let limit = null;

// Parse optional limit argument
for (const arg of args) {
    if (arg.startsWith('--limit=')) {
        limit = parseInt(arg.split('=')[1], 10);
    }
}

// Verify file exists
const absolutePath = path.isAbsolute(csvPath) ? csvPath : path.resolve(process.cwd(), csvPath);
if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
}

/**
 * Normalize phone number - extract last 10 digits
 */
function normalizePhone(phone) {
    if (!phone) return null;
    const digits = phone.toString().replace(/\D/g, '');
    if (digits.length >= 10) {
        return digits.slice(-10);
    }
    return digits.length > 0 ? digits : null;
}

/**
 * Parse number safely
 */
function parseNumber(val) {
    if (!val || val === '') return null;
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
}

/**
 * Get first non-empty value from multiple fields
 */
function getFirstValue(...values) {
    for (const val of values) {
        if (val && val.toString().trim() !== '') {
            return val.toString().trim();
        }
    }
    return null;
}

/**
 * Import CSV file into MongoDB breaches collection
 */
async function importCsv() {
    console.log(`\n📂 CSV Breach Importer`);
    console.log(`${'='.repeat(50)}`);
    console.log(`File: ${absolutePath}`);
    console.log(`Breach Name: ${breachName}`);
    console.log(`Limit: ${limit || 'None (full import)'}`);
    console.log(`${'='.repeat(50)}\n`);

    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check for existing records with same breach name
    const existingCount = await Breach.countDocuments({ breachName });
    if (existingCount > 0) {
        console.log(`⚠️  Found ${existingCount} existing records with breachName: ${breachName}`);
        console.log(`   These will NOT be duplicated.\n`);
    }

    let processed = 0;
    let inserted = 0;
    let errors = 0;
    let batch = [];
    const BATCH_SIZE = 1000;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(absolutePath)
            .pipe(csv());

        stream.on('data', async (row) => {
            // Check limit
            if (limit && processed >= limit) {
                stream.destroy();
                return;
            }

            processed++;

            // Normalize and extract fields
            const phone = normalizePhone(row.MOBILE_NO);

            // Skip rows without phone number
            if (!phone) {
                return;
            }

            // Build breach record
            const breachRecord = {
                breachName: breachName,
                sourceType: 'csv',

                // Primary identifiers
                phone: phone,
                name: getFirstValue(row.NAME, row.NAME_NP),
                fatherName: getFirstValue(row.FATHER_NAME, row.FATHER_NAME_NP),

                // Location data
                address: getFirstValue(row.ADDRESS, row.ADDRESS_NP),
                district: row.DISTRICT || null,
                town: row.TOWN || null,
                latitude: parseNumber(row.LAT),
                longitude: parseNumber(row.LON),

                // Utility-specific data
                connectionType: row.CONNECTION_TYPE || null,
                connectionStatus: row.CON_STATUS || null,
                loadAmount: row.LOAD || null,
                loadUnit: row.LOAD_UNIT || null,

                // Store FULL ROW as-is for complete access
                csvData: { ...row },

                // Track which field was used for matching
                matchedField: 'MOBILE_NO',

                createdAt: new Date()
            };

            batch.push(breachRecord);

            // Insert batch when full
            if (batch.length >= BATCH_SIZE) {
                stream.pause();

                try {
                    await Breach.insertMany(batch, { ordered: false });
                    inserted += batch.length;
                } catch (err) {
                    if (err.writeErrors) {
                        inserted += batch.length - err.writeErrors.length;
                        errors += err.writeErrors.length;
                    } else {
                        errors += batch.length;
                        console.error(`Batch error: ${err.message}`);
                    }
                }

                batch = [];

                // Progress update
                if (processed % 10000 === 0) {
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    console.log(`📊 Processed: ${processed.toLocaleString()} | Inserted: ${inserted.toLocaleString()} | Errors: ${errors} | Time: ${elapsed}s`);
                }

                stream.resume();
            }
        });

        stream.on('end', async () => {
            // Insert remaining batch
            if (batch.length > 0) {
                try {
                    await Breach.insertMany(batch, { ordered: false });
                    inserted += batch.length;
                } catch (err) {
                    if (err.writeErrors) {
                        inserted += batch.length - err.writeErrors.length;
                        errors += err.writeErrors.length;
                    } else {
                        errors += batch.length;
                    }
                }
            }

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

            console.log(`\n${'='.repeat(50)}`);
            console.log(`✅ Import Complete!`);
            console.log(`${'='.repeat(50)}`);
            console.log(`📊 Rows Processed: ${processed.toLocaleString()}`);
            console.log(`✅ Records Inserted: ${inserted.toLocaleString()}`);
            console.log(`❌ Errors: ${errors}`);
            console.log(`⏱️  Time: ${elapsed}s`);
            console.log(`${'='.repeat(50)}\n`);

            await mongoose.connection.close();
            resolve({ processed, inserted, errors });
        });

        stream.on('error', async (err) => {
            console.error('Stream error:', err);
            await mongoose.connection.close();
            reject(err);
        });

        stream.on('close', async () => {
            // Handle early stream close (limit reached)
            if (batch.length > 0) {
                try {
                    await Breach.insertMany(batch, { ordered: false });
                    inserted += batch.length;
                } catch (err) {
                    if (err.writeErrors) {
                        inserted += batch.length - err.writeErrors.length;
                        errors += err.writeErrors.length;
                    }
                }
            }

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

            console.log(`\n${'='.repeat(50)}`);
            console.log(`✅ Import Complete (Limit: ${limit})`);
            console.log(`${'='.repeat(50)}`);
            console.log(`📊 Rows Processed: ${processed.toLocaleString()}`);
            console.log(`✅ Records Inserted: ${inserted.toLocaleString()}`);
            console.log(`❌ Errors: ${errors}`);
            console.log(`⏱️  Time: ${elapsed}s`);
            console.log(`${'='.repeat(50)}\n`);

            await mongoose.connection.close();
            resolve({ processed, inserted, errors });
        });
    });
}

// Run import
importCsv().catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
});
