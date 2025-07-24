const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const certificationSchema = new Schema({
    itemId: {
        type: Schema.Types.ObjectId,
        required: true,
    },
    itemCat: {
        type: String,
        required: true,
    },    
    itemName: {
        type: String,
        required: true,
    },
    technicianId: {
        type: Schema.Types.ObjectId,
        required: true,
    },
    technicianFirstName: {
        type: String,
        required: true,
    },
    technicianLastName: {
        type: String,
        required: true,
    },
    certificationDocumentLink: {
        type: String,
        required: false,
    },
    firstCertificationDate: {
        type: Date,
        required: false,
    },
    lastCertificationDate: {
        type: Date,
        required: false,
    },
    lastCertificationExpirationDate: {
        type: Date,
        required: false,
    }
});

module.exports = mongoose.model("Certification", certificationSchema);
