const env = require("./../utils/env")
const mongoose = require("mongoose")
const https = require('https')
const http = require('http')

let backendTest = async (req, res) => {
    console.log("The backend is up");
    res.send("The backend is up on port : " + env.port);
}

let logServerDetails = async (req, res) => {
    res.status(200).send(env)
}

let checkDbStatus = async (req, res) => {
    const dbState = mongoose.connection.readyState;
    const states = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
    };

    res.status(200).json({
        status: states[dbState],
        connected: dbState === 1,
        dbName: env.db_name
    });
}

// Phone number profiling API endpoint
let getPhoneProfiling = async (req, res) => {
    try {
        const phoneNumber = req.body.phoneNumber || req.query.phoneNumber;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: "Phone number is required"
            });
        }

        // Clean phone number (remove any non-digit characters)
        const cleanNumber = phoneNumber.toString().replace(/\D/g, '');

        if (cleanNumber.length < 10) {
            return res.status(400).json({
                success: false,
                message: "Invalid phone number"
            });
        }

        // Call the external API
        const apiUrl = `https://numapi.anshapi.workers.dev/?num=${cleanNumber}`;

        https.get(apiUrl, (apiRes) => {
            let data = '';

            apiRes.on('data', (chunk) => {
                data += chunk;
            });

            apiRes.on('end', () => {
                try {
                    // Check if response is HTML (API error page)
                    if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html') || data.trim().startsWith('<')) {
                        console.error('External phone profiling API returned HTML error page');
                        return res.status(200).json({
                            success: false,
                            message: "Phone profiling service is temporarily unavailable. Please try again later.",
                            error: "External API returned HTML instead of JSON",
                            result: []
                        });
                    }

                    const response = JSON.parse(data);

                    // Remove credit field from response
                    if (response.credit) {
                        delete response.credit;
                    }

                    // Also remove credit from each result if present
                    if (response.result && Array.isArray(response.result)) {
                        response.result = response.result.map(item => {
                            const cleanItem = { ...item };
                            if (cleanItem.credit) {
                                delete cleanItem.credit;
                            }
                            return cleanItem;
                        });
                    }

                    res.status(200).json(response);
                } catch (error) {
                    console.error('Error parsing API response:', error);
                    res.status(200).json({
                        success: false,
                        message: "Phone profiling service returned an invalid response. Please try again later.",
                        error: error.message,
                        result: []
                    });
                }
            });
        }).on('error', (error) => {
            console.error('Error calling profiling API:', error);
            res.status(200).json({
                success: false,
                message: "Error calling profiling API",
                error: error.message,
                result: []
            });
        });

    } catch (error) {
        console.error('Error in getPhoneProfiling:', error);
        res.status(200).json({
            success: false,
            message: "Internal server error",
            error: error.message,
            result: []
        });
    }
}

// Email profiling API endpoint
let getEmailProfiling = async (req, res) => {
    try {
        const email = req.body.email || req.query.email;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format"
            });
        }

        // Call the external API
        const apiUrl = 'https://leakosintapi.com/';
        const requestData = JSON.stringify({
            token: env.leak_osint_api_token || process.env.LEAK_OSINT_API_TOKEN || "",
            request: email.trim(),
            limit: 100
        });

        const url = require('url');
        const parsedUrl = url.parse(apiUrl);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestData)
            }
        };

        https.request(options, (apiRes) => {
            let data = '';

            apiRes.on('data', (chunk) => {
                data += chunk;
            });

            apiRes.on('end', () => {
                try {
                    const response = JSON.parse(data);

                    // Remove price and free_requests_left fields if present
                    if (response.price !== undefined) {
                        delete response.price;
                    }
                    if (response.free_requests_left !== undefined) {
                        delete response.free_requests_left;
                    }
                    if (response['search time'] !== undefined) {
                        delete response['search time'];
                    }

                    res.status(200).json(response);
                } catch (error) {
                    console.error('Error parsing API response:', error);
                    res.status(200).json({
                        success: false,
                        message: "Error parsing API response",
                        error: error.message,
                        result: []
                    });
                }
            });
        }).on('error', (error) => {
            console.error('Error calling email profiling API:', error);
            res.status(200).json({
                success: false,
                message: "Error calling email profiling API",
                error: error.message,
                result: []
            });
        }).end(requestData);

    } catch (error) {
        console.error('Error in getEmailProfiling:', error);
        res.status(200).json({
            success: false,
            message: "Internal server error",
            error: error.message,
            result: []
        });
    }
}

module.exports = {
    backendTest: backendTest,
    logServerDetails: logServerDetails,
    checkDbStatus: checkDbStatus,
    getPhoneProfiling: getPhoneProfiling,
    getEmailProfiling: getEmailProfiling
}
