const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const notificationSchema = new Schema({
    subject: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    read: {
        type: Boolean
    }
}, { timestamps: { createdAt: true, updatedAt: false }});

notificationSchema.index({ user: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
