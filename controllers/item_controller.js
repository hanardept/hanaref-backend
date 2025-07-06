const Item = require("../models/item");

module.exports = {
    // MODIFIED: This function now handles the 'status' query parameter
    getItems: async (req, res) => {
        const { cat, section, status } = req.query; // Get 'status' from the URL

        try {
            // 1. Start with an empty query object.
            let query = {};
            if (cat) {
                query.cat = cat;
            } else if (section) {
                query.section = section;
            }

            // 2. Add the 'archived' filter based on the 'status' parameter.
            // If the frontend sends status=all, we show everything.
            // Otherwise, we default to showing only active items.
            if (status !== 'all') {
                query.archived = false;
            }

            // 3. Execute the query.
            const items = await Item.find(query);
            res.status(200).json(items);

        } catch (err) {
            console.error("Error in getItems:", err);
            res.status(500).json(err);
        }
    },

    getItemInfo: async (req, res) => {
    },

    addItem: (req, res) => {
    },

    editItem: (req, res) => {
    },

    deleteItem: (req, res) => {
    },

    // NEW: This function was added to toggle the archived flag
    toggleArchive: async (req, res) => {
        try {
            // We use req.params.cat to find the item, following your app's convention.
            const item = await Item.findOne({ cat: req.params.cat });

            if (!item) {
                return res.status(404).send('Item not found.');
            }

            // This is the core logic: it flips the boolean value.
            item.archived = !item.archived;
            await item.save();

            // Send the updated item back to the frontend.
            res.status(200).json(item);

        } catch (error) {
            console.error(`Error toggling archive for item ${req.params.cat}:`, error);
            res.status(500).send('A server error occurred.');
        }
    },
};
