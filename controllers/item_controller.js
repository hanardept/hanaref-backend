const Item = require("../models/Item");
const { decodeItems } = require("../functions/helpers");
const Sector = require("../models/Sector");

function preliminaryItem(item, sector, department) {
    return { name: item.name, cat: item.cat, sector: sector, department: department, imageLink: "" };
}

module.exports = {
    async getItems(req, res) {
        // GET path: /items?search=jjo&sector=sj&department=wji&page=0
        // called via DEBOUNCE while entering Search word / choosing sector/dept
        const { search, sector, department, status, page = 0 } = req.query;
        const [decodedSearch, decodedSector, decodedDepartment] = decodeItems(search, sector, department);
        // privilege stored in req.userPrivilege ("public"/"hanar"/"admin")
        // currently we work in a binary fashion - "public" can see only public items, other privileges can see ALL items
        try {
            let sectorsVisibleForPublic = null;
            if (req.userPrivilege === "public") {
                // find only the sectors visible to public
                rawSectorObjects = await Sector.find({ visibleToPublic: true }, { sectorName: 1 });
                sectorsVisibleForPublic = rawSectorObjects.map((s) => s.sectorName);
            }

            const items = await Item.aggregate([
                {
                    $match: sectorsVisibleForPublic ? { sector: { $in: sectorsVisibleForPublic } } : {},
                },
                {
                    $match: search
                        ? {
                              $or: [
                                  { name: { $regex: decodedSearch, $options: "i" } },
                                  { cat: { $regex: decodedSearch } },
                                  { "models.name": { $regex: decodedSearch, $options: "i" } },
                                  { "models.cat": { $regex: decodedSearch, $options: "i" } },
                              ],
                          }
                        : {},
                },
                {
                    $match: sector ? { sector: decodedSector } : {},
                },
                {
                    $match: department ? { department: decodedDepartment } : {},
                },
                {
                    $match: status !== 'all' ? { archived: {$ne: true} } : {},
                },
                {
                    $project: { name: 1, cat: 1, _id: 1, imageLink: 1, archived: 1  },
                },
            ])
                .sort("name")
                .skip(page * 20)
                .limit(20);
            res.status(200).send(items);
        } catch (error) {
            res.status(400).send(`Error fetching items: ${error}`);
        }
    },

    async getItemInfo(req, res) {
        // THIS FUNCTION HAS BEEN CORRECTED TO FIX THE DUPLICATION ISSUE
        try {
            let sectorsVisibleForPublic = null;
            if (req.userPrivilege === "public") {
                // find only the sectors visible to public
                rawSectorObjects = await Sector.find({ visibleToPublic: true }, { sectorName: 1 });
                sectorsVisibleForPublic = rawSectorObjects.map((s) => s.sectorName);
            }

            const item = (await Item.aggregate([
                { $match: { cat: req.params.cat } },
                { $unwind: { path: '$accessories', preserveNullAndEmptyArrays: true } },
                { $lookup: { from: 'items', localField: 'accessories.cat', foreignField: 'cat', as: 'accessories_image', pipeline: [{ $project: { imageLink: 1 } }] } },
                { $unwind: { path: '$accessories_image', preserveNullAndEmptyArrays: true } },
                { $set: { "accessories.imageLink": { $cond: { if: { $ne: [{ $type: "$accessories_image" }, "missing"] }, then: "$accessories_image.imageLink", else: "$$REMOVE" } } } },
                {
                    $group: {
                        _id: '$_id',
                        accessories: { $addToSet: '$accessories' },
                        root: { $first: '$$ROOT' }
                    }
                },
                { $replaceRoot: { newRoot: { $mergeObjects: ["$root", { accessories: "$accessories" }] } } },
                { $unwind: { path: '$models', preserveNullAndEmptyArrays: true } },
                { $lookup: { from: 'items', localField: 'models.cat', foreignField: 'cat', as: 'models_image', pipeline: [{ $project: { imageLink: 1 } }] } },
                { $unwind: { path: '$models_image', preserveNullAndEmptyArrays: true } },
                { $set: { "models.imageLink": { $cond: { if: { $ne: [{ $type: "$models_image" }, "missing"] }, then: "$models_image.imageLink", else: "$$REMOVE" } } } },
                {
                    $group: {
                        _id: '$_id',
                        models: { $addToSet: '$models' },
                        root: { $first: '$$ROOT' }
                    }
                },
                { $replaceRoot: { newRoot: { $mergeObjects: ["$root", { models: "$models" }] } } },
                { $unwind: { path: '$consumables', preserveNullAndEmptyArrays: true } },
                { $lookup: { from: 'items', localField: 'consumables.cat', foreignField: 'cat', as: 'consumables_image', pipeline: [{ $project: { imageLink: 1 } }] } },
                { $unwind: { path: '$consumables_image', preserveNullAndEmptyArrays: true } },
                { $set: { "consumables.imageLink": { $cond: { if: { $ne: [{ $type: "$consumables_image" }, "missing"] }, then: "$consumables_image.imageLink", else: "$$REMOVE" } } } },
                {
                    $group: {
                        _id: '$_id',
                        consumables: { $addToSet: '$consumables' },
                        root: { $first: '$$ROOT' }
                    }
                },
                { $replaceRoot: { newRoot: { $mergeObjects: ["$root", { consumables: "$consumables" }] } } },
                { $unwind: { path: '$kitItem', preserveNullAndEmptyArrays: true } },
                { $lookup: { from: 'items', localField: 'kitItem.cat', foreignField: 'cat', as: 'kitItem_image', pipeline: [{ $project: { imageLink: 1 } }] } },
                { $unwind: { path: '$kitItem_image', preserveNullAndEmptyArrays: true } },
                { $set: { "kitItem.imageLink": { $cond: { if: { $ne: [{ $type: "$kitItem_image" }, "missing"] }, then: "$kitItem_image.imageLink", else: "$$REMOVE" } } } },
                {
                    $group: {
                        _id: '$_id',
                        kitItem: { $addToSet: '$kitItem' },
                        root: { $first: '$$ROOT' }
                    }
                },
                { $replaceRoot: { newRoot: { $mergeObjects: ["$root", { kitItem: "$kitItem" }] } } },
                {
                    $set: {
                        accessories: { $filter: { input: "$accessories", as: "item", cond: { $and: [ { $ne: ["$$item.name", null] }, { $ne: [{ $type: "$$item.name" }, "missing"] } ] } } },
                        models: { $filter: { input: "$models", as: "item", cond: { $and: [ { $ne: ["$$item.name", null] }, { $ne: [{ $type: "$$item.name" }, "missing"] } ] } } },
                        consumables: { $filter: { input: "$consumables", as: "item", cond: { $and: [ { $ne: ["$$item.name", null] }, { $ne: [{ $type: "$$item.name" }, "missing"] } ] } } },
                        kitItem: { $filter: { input: "$kitItem", as: "item", cond: { $and: [ { $ne: ["$$item.name", null] }, { $ne: [{ $type: "$$item.name" }, "missing"] } ] } } }
                    }
                },
                {
                    $project: {
                        root: 0,
                        accessories_image: 0,
                        models_image: 0,
                        consumables_image: 0,
                        kitItem_image: 0
                    }
                }
            ]))?.[0];

            if (item) {
                if (req.userPrivilege === "public" && !sectorsVisibleForPublic.includes(item.sector)) {
                    return res.status(401).send("You are not authorized to view this item.");
                }

                res.status(200).send(item);
            } else {
                res.status(404).send("Item could not be found in database");
            }
        } catch (error) {
            res.status(400).send("Item fetch error: ", error);
        }
    },

    // admin-only controllers:
    async addItem(req, res) {
        // POST path: /items
        const {
            name, cat, sector, department, catType, description, imageLink, qaStandardLink, models, accessories, consumables, belongsToKits, similarItems, kitItem,
        } = req.body;

        const newItem = new Item({
            name, cat, sector, department, catType, description, imageLink, qaStandardLink, models, accessories, consumables, belongsToKits, similarItems, kitItem,
        });

        try {
            const catAlreadyExists = await Item.findOne({ cat: cat });
            if (catAlreadyExists) return res.status(400).send({ errorMsg: "This catalog number is already in the database." });

            const mongoInsertPromises = [newItem.save()];

            if (accessories && accessories.length > 0)
                accessories.forEach((a) =>
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: a.cat }, { $setOnInsert: preliminaryItem(a, sector, department) }, { upsert: true })
                    )
                );
            if (consumables && consumables.length > 0)
                consumables.forEach((c) =>
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: c.cat }, { $setOnInsert: preliminaryItem(c, sector, department) }, { upsert: true })
                    )
                );
            if (belongsToKits && belongsToKits.length > 0)
                belongsToKits.forEach((b) =>
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: b.cat }, { $setOnInsert: preliminaryItem(b, sector, department) }, { upsert: true })
                    )
                );
            if (similarItems && similarItems.length > 0)
                similarItems.forEach((s) =>
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: s.cat }, { $setOnInsert: preliminaryItem(s, sector, department) }, { upsert: true })
                    )
                );
            if (kitItem && kitItem.length > 0)
                kitItem.forEach((i) =>
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: i.cat }, { $setOnInsert: preliminaryItem(i, sector, department) }, { upsert: aptrue })
                    )
                );

            await Promise.all(mongoInsertPromises);
            res.status(200).send("Item saved successfully!");
        } catch (error) {
            res.status(400).send("Failure saving item: ", error);
        }
    },

    async editItem(req, res) {
        // PUT path: /items/962780438
        const {
            name, cat, sector, department, catType, description, imageLink, qaStandardLink, models, accessories, consumables, belongsToKits, similarItems, kitItem,
        } = req.body;

        try {
            const updateOwnItem = Item.findOneAndUpdate(
                { cat: req.params.cat },
                { name, cat, sector, department, catType, description, imageLink, qaStandardLink, models, accessories, consumables, belongsToKits, similarItems, kitItem, }
            );

            const mongoInsertPromises = [updateOwnItem];
            
            if (accessories && accessories.length > 0)
                accessories.forEach((a) =>
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: a.cat }, { $setOnInsert: preliminaryItem(a, sector, department) }, { upsert: true })
                    )
                );
            if (consumables && consumables.length > 0)
                consumables.forEach((c) =>
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: c.cat }, { $setOnInsert: preliminaryItem(c, sector, department) }, { upsert: true })
                    )
                );
            if (belongsToKits && belongsToKits.length > 0)
                belongsToKits.forEach((b) =>
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: b.cat }, { $setOnInsert: preliminaryItem(b, sector, department) }, { upsert: true })
                    )
                );
            if (similarItems && similarItems.length > 0)
                similarItems.forEach((s) =>
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: s.cat }, { $setOnInsert: preliminaryItem(s, sector, department) }, { upsert: true })
                    )
                );
            if (kitItem && kitItem.length > 0)
                kitItem.forEach((i) =>
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: i.cat }, { $setOnInsert: preliminaryItem(i, sector, department) }, { upsert: true })
                    )
                );

            await Promise.all(mongoInsertPromises);
            res.status(200).send("Item updated successfully!");
        } catch (error) {
            res.status(400).send("Failure updating item: ", error);
        }
    },
    
    async deleteItem(req, res) {
        // DELETE path: /items/962780438
        try {
            await Item.findOneAndRemove({ cat: req.params.cat });
            res.status(200).send("Item removed successfully!");
        } catch (error) {}
    },

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
