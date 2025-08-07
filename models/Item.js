const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const nameAndCatSchema = new Schema({
    name: String,
    cat: String,
});

const itemSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    cat: {
        type: String,
        required: true,
        unique: true,
    },
    kitCats: {
        type: [String],
        required: false,
    },    
    sector: {
        type: String,
        required: true,
    },
    department: {
        type: String,
        required: true,
    },
    catType: {
        type: String,
        default: "מכשיר",
    },
    archived: {
        type: Boolean,
        default: false,
    },
    certificationPeriodMonths: {
        type: Number,
        default: 0,
        required: false,
    },
    description: String,
    imageLink: String,
    qaStandardLink: String,
    medicalEngineeringManualLink: String,
    userManualLink: String,
    serviceManualLink: String,
    hebrewManualLink: String,
    supplier: String,
    lifeSpan: String,
    models: [new Schema({ ...nameAndCatSchema.obj, manufacturer: String })],
    accessories: [nameAndCatSchema],
    consumables: [nameAndCatSchema],
    spareParts: [nameAndCatSchema],
    belongsToDevices: [nameAndCatSchema],
    similarItems: [nameAndCatSchema],
    kitItem: [nameAndCatSchema],
});

module.exports = mongoose.model("Item", itemSchema);