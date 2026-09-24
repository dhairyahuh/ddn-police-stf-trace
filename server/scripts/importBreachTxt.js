#!/usr/bin/env node
/**
 * Breach Data Importer Script
 * 
 * Usage:
 *   node scripts/importBreachTxt.js <file_path> <breach_name> [--limit=N]
 * 
 * Example:
 *   node scripts/importBreachTxt.js /path/to/COLLEGEDEKHO.COM.txt CollegeDekho_2024
 *   node scripts/importBreachTxt.js /path/to/breach.txt TestBreach --limit=100
 */

const mongoose = require("mongoose");
const fs = require("fs");
const readline = require("readline");
const path = require("path");

// MongoDB connection string
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/CDR_Visualizer";

// Import the Breach model
const { Breach } = require("../models/breachDetails");

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error("Usage: node importBreachTxt.js <file_path> <breach_name> [--limit=N]");
    console.error("Example: node importBreachTxt.js /path/to/breach.txt CollegeDekho_2024");
    process.exit(1);
}

const filePath = args[0];
const breachName = args[1];
let recordLimit = null;

// Parse optional limit flag
args.forEach(arg => {
    if (arg.startsWith("--limit=")) {
        recordLimit = parseInt(arg.split("=")[1], 10);
    }
});

// Validate file exists
if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
}

/**
 * Parse a single CSV line respecting quoted values
 */
function parseCSVLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

/**
 * Normalize phone number (remove non-numeric, keep last 10 digits)
 */
function normalizePhone(phone) {
    if (!phone) return null;
    const cleaned = phone.toString().replace(/\D/g, "");
    return cleaned.length >= 10 ? cleaned.slice(-10) : cleaned || null;
}

/**
 * Normalize email (lowercase, trim)
 */
function normalizeEmail(email) {
    if (!email || email === "None" || email === "null") return null;
    return email.toString().toLowerCase().trim();
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr) {
    if (!dateStr || dateStr === "None" || dateStr === "null") return null;
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Parse boolean from Python string representation
 */
function parseBoolean(val) {
    if (!val || val === "None" || val === "null") return null;
    return val.toString().toLowerCase() === "true" || val === "1";
}

/**
 * Main import function
 */
async function importBreachData() {
    console.log(`\n📥 Breach Data Importer`);
    console.log(`========================`);
    console.log(`File: ${filePath}`);
    console.log(`Breach Name: ${breachName}`);
    if (recordLimit) console.log(`Limit: ${recordLimit} records`);
    console.log();

    // Connect to MongoDB
    try {
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            useCreateIndex: true
        });
        console.log("✅ Connected to MongoDB");
    } catch (err) {
        console.error("❌ MongoDB connection failed:", err.message);
        process.exit(1);
    }

    // Create readline interface
    const fileStream = fs.createReadStream(filePath, { encoding: "utf8" });
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let headers = null;
    let lineCount = 0;
    let importedCount = 0;
    let errorCount = 0;
    let batch = [];
    const BATCH_SIZE = 100;

    const startTime = Date.now();

    for await (const line of rl) {
        lineCount++;

        // Skip empty lines
        if (!line.trim()) continue;

        // First non-empty line is the header
        if (!headers) {
            headers = parseCSVLine(line).map(h => h.toLowerCase().trim());
            console.log(`📋 Detected columns: ${headers.join(", ")}`);
            continue;
        }

        // Check limit
        if (recordLimit && importedCount >= recordLimit) {
            break;
        }

        try {
            const values = parseCSVLine(line);
            const rowData = {};

            // Map values to headers
            headers.forEach((header, idx) => {
                rowData[header] = values[idx] || null;
            });

            // Create breach record with field mapping
            const breachRecord = {
                breachName: breachName,
                sourceType: "txt",
                recordId: parseInt(rowData["id"], 10) || null,
                name: rowData["name"] || null,
                phone: normalizePhone(rowData["phone no"] || rowData["phone"] || rowData["mobile"]),
                email: normalizeEmail(rowData["email"]),
                username: rowData["username"] || null,
                isStaff: parseBoolean(rowData["is staff"] || rowData["is_staff"]),
                isActive: parseBoolean(rowData["is active"] || rowData["is_active"]),
                isSuperuser: parseBoolean(rowData["is superuser"] || rowData["is_superuser"]),
                buId: parseInt(rowData["bu id"] || rowData["bu_id"], 10) || null,
                joiningDate: parseDate(rowData["joining date"] || rowData["joining_date"]),
                addedOn: parseDate(rowData["added on"] || rowData["added_on"]),
                modifiedOn: parseDate(rowData["modified on"] || rowData["modified_on"]),
                objectStatus: parseInt(rowData["object status"] || rowData["object_status"], 10) || null,
                passwordHash: rowData["password"] || null,
                rawRow: line
            };

            // Only add records with at least phone or email
            if (breachRecord.phone || breachRecord.email) {
                batch.push(breachRecord);

                // Insert batch when full
                if (batch.length >= BATCH_SIZE) {
                    await Breach.insertMany(batch, { ordered: false }).catch(e => {
                        if (e.writeErrors) errorCount += e.writeErrors.length;
                    });
                    importedCount += batch.length;
                    process.stdout.write(`\r⏳ Imported: ${importedCount} records...`);
                    batch = [];
                }
            }
        } catch (err) {
            errorCount++;
            if (errorCount < 5) {
                console.error(`\n⚠️ Error on line ${lineCount}: ${err.message}`);
            }
        }
    }

    // Insert remaining batch
    if (batch.length > 0) {
        await Breach.insertMany(batch, { ordered: false }).catch(e => {
            if (e.writeErrors) errorCount += e.writeErrors.length;
        });
        importedCount += batch.length;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n\n✅ Import Complete!`);
    console.log(`========================`);
    console.log(`📊 Total lines processed: ${lineCount}`);
    console.log(`✅ Records imported: ${importedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`⏱️ Time elapsed: ${elapsed}s`);

    // Close connection
    await mongoose.connection.close();
    console.log("\n👋 MongoDB connection closed");
}

// Run the import
importBreachData().catch(err => {
    console.error("Import failed:", err);
    process.exit(1);
});
