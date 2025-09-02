const Notification = require("../models/Notification");

module.exports = {
    async getNotifications(req, res) {
        const { userId } = req;

        console.log(`getting notification for user with id: ${userId}`);

        let { page = 0 } = req.query;

        console.log(`Fetching notifications with page: ${page}`);
        try {

            const notifications = await Notification
                .find({ user: userId})
                .sort({ createdAt: 'desc' })
                .skip(page * 20)
                .limit(20);

            console.log(`found ${notifications.length} notifications`);
            
            res.status(200).send(notifications);
        } catch (error) {
            console.error(`Error fetching notifications: ${error}`);
            res.status(400).send('Error fetching notifications');
        }
    },

    markAsRead: async (req, res) => {
        try {
            const { userId } = req;
            const notification = await Notification.findOne({ _id: req.params.id, user: userId });

            if (!notification) {
                return res.status(404).send('Notification not found.');
            }

            notification.read = true;
            await notification.save(),

            res.status(200).json(notification);

        } catch (error) {
            console.error(`Error marking notification as read for id ${req.params.id}:`, error);
            res.status(500).send('A server error occurred.');
        }
    }, 

    async deleteNotification(req, res) {
        // DELETE path: /notifications/962780438
        try {
            await Notification.findByIdAndRemove(req.params.id);
            res.status(200).send("Notification removed successfully!");
        } catch (error) {
            console.log(`Error deleting notification: ${error}`);
            res.status(400).send("Failure deleting notification");            
        }
    },    
};
