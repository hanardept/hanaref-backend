const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const NotificationType = require('./NotificationType');

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
    type: {
        type: String,
        enum: Object.values(NotificationType),
        required: true
    },
    data: {
        type: Schema.Types.Mixed,
    },
    read: {
        type: Boolean
    }
}, { timestamps: { createdAt: true, updatedAt: false }});

notificationSchema.index({ user: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
