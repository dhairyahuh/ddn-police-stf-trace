#!/usr/bin/env node
/**
 * Instagram JSON Breach Data Importer
 * 
 * Imports Instagram breach data from JSON Lines format into the breaches collection.
 * Each line in the file is a separate JSON object.
 * 
 * Field Mapping:
 *   u → username
 *   e → email
 *   t → phone
 *   id → instagramId
 *   n → name
 *   a → address
 * 
 * Usage:
 *   node scripts/importInstagramJson.js <json-file> <breach-name> [--limit=N]
 * 
 * Example:
 *   node scripts/importInstagramJson.js instagram.json Instagram_Leak_2024 --limit=1000
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mongoose = require('mongoose');
const { Breach } = require('../models/breachDetails');

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/CDR_Visualizer';

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('Usage: node scripts/importInstagramJson.js <json-file> <breach-name> [--limit=N]');
    console.error('Example: node scripts/importInstagramJson.js instagram.json Instagram_Leak_2024 --limit=1000');
    process.exit(1);
}

const jsonPath = args[0];
const breachName = args[1];
let limit = null;

// Parse optional limit argument
for (const arg of args) {
    if (arg.startsWith('--limit=')) {
        limit = parseInt(arg.split('=')[1], 10);
    }
}

// Verify file exists
const absolutePath = path.isAbsolute(jsonPath) ? jsonPath : path.resolve(process.cwd(), jsonPath);
if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
}

/**
 * Normalize phone number - strip non-digits, keep last 10-15 digits
 * Handles international formats like +1234567890
 */
function normalizePhone(phone) {
    if (!phone) return null;
    // Remove all non-digits
    const digits = phone.toString().replace(/\D/g, '');
    if (digits.length >= 10) {
        // Keep full number for international matching, but also store normalized
        return digits;
    }
    return digits.length > 0 ? digits : null;
}

/**
 * Import JSON Lines file into MongoDB
 */
async function importJson() {
    console.log(`\n📸 Instagram JSON Breach Importer`);
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
    let skipped = 0;
    let batch = [];
    const BATCH_SIZE = 1000;
    const startTime = Date.now();

    // Create readline interface for streaming
    const fileStream = fs.createReadStream(absolutePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        // Check limit
        if (limit && processed >= limit) {
            break;
        }

        // Skip empty lines
        if (!line.trim()) continue;

        processed++;

        try {
            // Parse JSON line
            const record = JSON.parse(line.trim());

            // Extract and normalize fields
            const username = record.u ? record.u.toLowerCase().trim() : null;
            const email = record.e ? record.e.toLowerCase().trim() : null;
            const phone = normalizePhone(record.t);
            const instagramId = record.id ? String(record.id) : null;
            const name = record.n || null;
            const address = record.a || null;

            // Skip records without any searchable field
            if (!username && !email && !phone) {
                skipped++;
                continue;
            }

            // Build breach record for Instagram
            const breachRecord = {
                breachName: breachName,
                sourceType: 'json',
                platform: 'Instagram',

                // Searchable fields
                username: username,
                email: email,
                phone: phone,
                instagramId: instagramId,
                name: name,
                address: address,

                // Store FULL JSON object
                jsonData: { ...record },

                // Track matched field (will be set during search)
                matchedField: null,

                createdAt: new Date()
            };

            batch.push(breachRecord);

            // Insert batch when full
            if (batch.length >= BATCH_SIZE) {
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
                    console.log(`📊 Processed: ${processed.toLocaleString()} | Inserted: ${inserted.toLocaleString()} | Skipped: ${skipped} | Errors: ${errors} | Time: ${elapsed}s`);
                }
            }

        } catch (parseError) {
            errors++;
            if (errors <= 5) {
                console.error(`Parse error on line ${processed}: ${parseError.message}`);
            }
        }
    }

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
    console.log(`📊 Lines Processed: ${processed.toLocaleString()}`);
    console.log(`✅ Records Inserted: ${inserted.toLocaleString()}`);
    console.log(`⏭️  Skipped (no searchable field): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`⏱️  Time: ${elapsed}s`);
    console.log(`${'='.repeat(50)}\n`);

    await mongoose.connection.close();
    return { processed, inserted, skipped, errors };
}

// Run import
importJson().catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
});
