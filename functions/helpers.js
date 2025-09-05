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

async function notifyRole({ role, type, subject, message, exceptedUser, data, deletedNotifications }) {
    console.log(`notifying role with params: ${JSON.stringify({ role, type, subject, message, exceptedUser, data, deletedNotifications })}`);
    const notifiedUsersFilter = { role };
    if (exceptedUser) {
        notifiedUsersFilter._id = { $ne: exceptedUser.user._id };
    }
    console.log(`notified users condition: ${JSON.stringify(notifiedUsersFilter)}`);
    const allUsers = await User.find();
    const users = await User.find(notifiedUsersFilter);
    console.log(`find all users: ${JSON.stringify(allUsers)}`);
    console.log(`find users for notifications: ${JSON.stringify(users)}`);
    const notifications = [
        ...users.map(user => new Notification({
            user,
            type,
            subject,
            message,
            data,
        })),
        exceptedUser && new Notification({
            user: exceptedUser.user,
            type,
            subject,
            message: exceptedUser.message,
            data,
        })
    ].filter(Boolean);

    try {
        console.log(`creating notifications: ${JSON.stringify(notifications)}`);
        await Notification.create(notifications);
        console.log(`deleted notifications: ${JSON.stringify(deletedNotifications)}`);
        if (deletedNotifications) {
            console.log(`deleting notifications with filter: ${JSON.stringify({ 
                type: deletedNotifications.type,
                // user: exceptedUserId ? { _id: { $ne: exceptedUserId }} : undefined,
                data: { user: { email: data?.user?.email } }
            })}`)
            await Notification.deleteMany({ 
                type: deletedNotifications.type,
                // user: exceptedUserId ? { _id: { $ne: exceptedUserId }} : undefined,
                "data.user.email": data?.user?.email
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