const Notification = require("../models/Notification");
const User = require("../models/User");

function decodeItems(...arguments) {
    return arguments.map((item) => decodeURI(item));
}

async function notifyUser({ user, type, subject, message, data = undefined }) {
    const notification = new Notification({
        user,
        type,
        subject,
        message,
        data
    });

    try {
        await notification.save();
    } catch(error) {
        console.error(`Error creating notification for user: ${user._id}: ${error}`);
    }
}

async function notifyRole({ role, type, subject, message, data = undefined }) {
    const users = await User.find({ role });
    const notifications = users.map(user => new Notification({
        user,
        type,
        subject,
        message,
        data
    }));

    try {
        await Notification.create(notifications);
    } catch(error) {
        console.error(`Error creating notifications for role: ${role}: ${error}`);
    }
}

module.exports = {
    decodeItems,
    notifyUser,
    notifyRole,
};