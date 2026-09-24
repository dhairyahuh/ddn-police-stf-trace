const mongoose = require("mongoose")
const Schema = mongoose.Schema
const Model = mongoose.model

const ipDataRecords = Schema({
    // Case Number Reference
    caseNumber: {type: String, required: true, index: true},

    // Private IP - E.g. 1.2.3.4 or IPv6
    privateIP : {type : String, required : true, index : true, minLength : 7, maxLength : 45},

    // Private Port
    privatePort : {type : Number, default: 0},

    // Public IP - E.g. 1.2.3.4 or IPv6 (Optional for IPv6 records without NAT)
    publicIP : {type : String, index : true, minLength : 7, maxLength : 45},

    // Public Port
    publicPort : {type : Number, default: 0},

    // Destination IP (optional for cellular IPDR)
    destIP: {type : String, index : true, maxLength : 45, default: 'N/A'},

    // Destination Port (optional for cellular IPDR)
    destPort : {type : Number, default: 0},
    
    // Protocol (TCP/UDP/ICMP)
    protocol: {type: String, index: true},

    // Caller name - Optional
    associatedName : {type : String, index : true}, 

    // Time of connecting
    startTime : {type : Date, required : true, default : Date.now},

    // Time of disconnecting
    endTime : {type : Date, required : true, default : Date.now},
    
    // Uplink Volume
    uplinkVolume : {type : Number, default: 0},

    // Downlink Volume
    downlinkVolume : {type : Number, default: 0},

    // Total Volume
    totalVolume : {type : Number, default: 0},
    
    // Duration in seconds
    duration: {type: Number, default: 0},
    
    // Roaming Indicator
    roamingIndicator: {type: String},

    //Cell ID where connection was initiated
    originCellID: {type: String, required: true, index: true},
    
    // Position where call was initiated
    originLatLong : {
        type : {
            lat : Schema.Decimal128,
            long : Schema.Decimal128    
        },
        required: true
    },

    // IMEI
    imei : {type : String, required : true, maxLength : 15},
    
    // IMSI
    imsi : {type : String, required : true, maxLength : 15},
    
    // Access type / I_RATTYPE
    accessType : {
        type : String
    },
    
    // === ADVANCED ANALYSIS FIELDS ===
    
    // Service Type (detected from port/pattern analysis)
    serviceType: {type: String, index: true},
    
    // Application Name (WhatsApp, Telegram, Browser, etc.)
    application: {type: String, index: true},
    
    // Flags for suspicious activity
    isVPN: {type: Boolean, default: false, index: true},
    isProxy: {type: Boolean, default: false, index: true},
    isTor: {type: Boolean, default: false, index: true},
    isEncrypted: {type: Boolean, default: false},
    isVoIP: {type: Boolean, default: false, index: true},
    isMessaging: {type: Boolean, default: false},
    isSuspicious: {type: Boolean, default: false, index: true},
    
    // Suspicion Reason
    suspicionReason: {type: String},
    
    // Party B Detection (correlated destination phone number)
    correlatedPartyB: {type: String, index: true},
    correlationConfidence: {type: Number, min: 0, max: 100},
    correlationMethod: {type: String},
    
    // VPN/Proxy Provider (if detected)
    vpnProvider: {type: String},
    vpnConfidence: {type: Number, min: 0, max: 100},
    
    // IP Geolocation & ASN Info
    destIPCountry: {type: String},
    destIPCity: {type: String},
    destIPASN: {type: String},
    destIPOrganization: {type: String},
    
    // Traffic Pattern Analysis
    trafficPattern: {type: String}, // 'burst', 'steady', 'intermittent'
    dataRatio: {type: Number}, // upload/download ratio
    
    // Metadata
    createdAt: {type: Date, default: Date.now}
});

module.exports = {
    IPDR : Model('ipDataRecords', ipDataRecords)
}
