const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const supplierSchema = new Schema({
    id: {
        type: String,
        required: true,
        unique: true,
    },
    name: {
        type: String,
        required: true,
        unique: true,
        max: 255,
        min: 2
    },
    street: {
        type: String,
        max: 255,
        min: 2
    },
    city: {
        type: String,
        max: 255,
        min: 2
    },
    officePhone: {
        type: String,
        max: 30,
        min: 6
    },
    contact: {
        type: String,
        max: 255,
        min: 6
    },
    contactCell: {
        type: String,
        max: 30,
        min: 6
    },
    contactEmail: {
        type: String,
        max: 255,
        min: 6
    },
});

module.exports = mongoose.model('Supplier', supplierSchema);