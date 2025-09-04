const Notification = require("../models/Notification");
const User = require("../models/User");

function decodeItems(...arguments) {
    return arguments.map((item) => decodeURI(item));
}

function getUserDisplayName(user) {
    const { firstName, lastName, email } = user;
    return firstName || lastName ?
        [firstName, lastName].filter(Boolean).join(' ') : email;
}

async function notifyUser({ userId, type, subject, message, data = undefined, deleteNotifications }) {
    const notification = new Notification({
        user: userId,
        type,
        subject,
        message,
        data
    });

    try {
        await notification.save();
        await Notification.deleteOne({ user: userId, data: { user: { email: data?.user?.email } }});
    } catch(error) {
        console.error(`Error creating notification for user id ${userId}: ${error}`);
    }
}

async function notifyRole({ role, type, subject, message, exceptedUserId, data, deletedNotifications }) {
    const users = await User.find({ role, _id: exceptedUserId ? { $ne: exceptedUserId } : undefined });
    const notifications = users.map(user => new Notification({
        user,
        type,
        subject,
        message,
        data,
    }));

    try {
        await Notification.create(notifications);
        if (deletedNotifications) {
            await Notification.deleteMany({ 
                role,
                type: deletedNotifications.type,
                user: exceptedUser ? { _id: { $ne: exceptedUser._id }} : undefined,
                data: { user: { email: data?.user?.email } }
            });
        }
    } catch(error) {
        console.error(`Error creating notifications for role: ${role}: ${error}`);
    }
}

module.exports = {
    decodeItems,
    getUserDisplayName,
    notifyUser,
    notifyRole,
};