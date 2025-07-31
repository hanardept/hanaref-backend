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
        enum: ["מכשיר", "אביזר", "מתכלה", "חלקי חילוף", "חלק חילוף"],
        default: "מכשיר",
    },
    archived: {
        type: Boolean,
        default: false,
    },
    certificationPeriodMonths: {
        type: Number,
        default: 0,
        required: true,
    },
    description: String,
    imageLink: String,
    qaStandardLink: String,
    models: [nameAndCatSchema],
    accessories: [nameAndCatSchema],
    consumables: [nameAndCatSchema],
    belongsToKits: [nameAndCatSchema],
    similarItems: [nameAndCatSchema],
    kitItem: [nameAndCatSchema],
});

module.exports = mongoose.model("Item", itemSchema);
