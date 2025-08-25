const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Role = require('./Role');

const userSchema = new Schema({
    id: {
        type: String,
        required: false,
    },
    firstName: {
        type: String,
        max: 255,
        min: 2
    },
    lastName: {
        type: String,
        max: 255,
        min: 2
    },        
    username: {
        type: String,
        required: true,
        unique: true,
        max: 255,
        min: 6
    },
    email: {
        type: String,
        required: true,
        unique: true,
        max: 255,
        min: 6
    },
    role: {
        type: String,
        enum: Object.values(Role),
        required: true
    },
    association: {
        type: String,
        required: false,
    },
    archived: {
        type: Boolean,
        required: false,
    },
    status: {
        type: String,
        required: false,
    }
});

module.exports = mongoose.model('User', userSchema);