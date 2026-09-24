const mongoose = require("mongoose")
const Schema = mongoose.Schema
const Model = mongoose.model

const callDataRecords = Schema({
    // Case Number Reference
    caseNumber: {type: String, required: true, index: true},

    // Caller number - 5-15 digit number (accommodates international and service codes)
    callerNumber : {type : String, required : true, index : true, minLength : 5, maxLength : 15},

    // Called party number - 5-15 digit number (accommodates service codes and international)
    calledNumber : {type : String, required : true, minLength : 3, maxLength : 15},

    // Caller name - Optional
    callerName : {type : String, index : true}, 

    // Call start time
    startTime : {type : Date, required : true, default : Date.now},

    // Call end time
    endTime : {type : Date, required : true, default : Date.now},
    
    // Call Duration 
    callDuration : {type : Number, required : true},
    
    //Cell ID where call was initiated
    originCellID: {type: String, required: true, index: true},

    //Cell ID where call was dropped
    destCellID: {type: String, required: true, index: true},

    // Position where call was initiated
    originLatLong : {
        type : {
            lat : Schema.Decimal128,
            long : Schema.Decimal128    
        },
        required: true
    },
    
    // Position where call was terminated
    destLatLong : {
        type : {
            lat : Schema.Decimal128,
            long : Schema.Decimal128    
        },
        required : true
    },

    // Call type - expanded to support all carriers
    callType : {
        type : String,
        enum : ['CALL-IN', 'CALL-OUT', 'SMS-IN', 'SMS-OUT', 'SMS', 'DATA', 'VOIP', 'VIDEO-CALL', 'MISSED'], 
        required : true
    },
    
    // IMEI - allow 10-20 characters to accommodate various formats
    imei : {type : String, required : true, maxLength : 20, minLength : 10},
    
    // IMSI - allow 10-20 characters to accommodate various formats
    imsi : {type : String, required : true, maxLength : 20, minLength : 10},
    
    // Connection type
    connectionType : {type : String},
    
    // Access type - expanded for all networks
    accessType : {
        type : String, 
        enum : ['2G', '3G', '4G', '5G', 'VoLTE', 'VoWiFi', 'LTE', null]
    },
    
    // Network Circle (Operator-Circle like AIR-UW, RJIL-UW)
    networkCircle : {type : String},
});

module.exports = {
    CDR : Model('callDataRecords', callDataRecords)
}
