const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const certificationSchema = new Schema({
    item: {
        type: Schema.Types.ObjectId,
        ref: "Item",
        required: true,
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
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
    lastCertificationDurationMonths: {
        type: Number,
        required: false,
    },
    plannedCertificationDate: {
        type: Date,
        required: false,
    },
    archived: {
        type: Boolean,
        required: false,
    }
});

certificationSchema.index({ item: 1, technician: 1}, { unique: true });

module.exports = mongoose.model("Certification", certificationSchema);
