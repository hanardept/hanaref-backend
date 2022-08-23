const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const nameAndCatSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    cat: {
        type: String,
        required: true,
        unique: true
    }
});

const itemSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    cat: {
        type: String,
        required: true,
        unique: true
    },
    sector: {
        type: String,
        required: true
    },
    department: {
        type: String,
        required: true
    },
    catType: {
        type: String,
        default: "regular"
    },
    description : String,
    imageLink: String,
    accessories: [nameAndCatSchema],
    consumables: [nameAndCatSchema],
    belongsToKits: [nameAndCatSchema],
    similarItems: [nameAndCatSchema],
    kitItem: [nameAndCatSchema],
    visibleTo: {
        type: String,
        default: "all"
    }
});

module.exports = mongoose.model('Item', itemSchema);