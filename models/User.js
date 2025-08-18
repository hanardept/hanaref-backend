const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    id: {
        type: String,
        required: true,
    },
    firstName: {
        type: String,
        max: 255,
        min: 6
    },
    lastName: {
        type: String,
        max: 255,
        min: 6
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
        required: true
    },
    association: {
        type: String,
        required: true,
    },
    archived: {
        type: Boolean,
        required: false,
    }
});

module.exports = mongoose.model('User', userSchema);