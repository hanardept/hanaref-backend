const Item = require("../models/Item");
const { decodeItems } = require("../functions/helpers");
const Sector = require("../models/Sector");

function preliminaryItem(item, sector, department) {
    return { name: item.name, cat: item.cat, sector: sector, department: department, imageLink: "" };
}

module.exports = {
    async getItems(req, res) {
        // GET path: /items

        try {
            // the function below returns either an array of item objects,
            // or an array of sector names, each including an array of department names,
            // each including an array of preliminary items.
            // the type of return value depends on the user's privilege.
            const items = await decodeItems(req.userPrivilege);
            res.status(200).send(items);
        } catch (error) {
            res.status(400).send("item fetch error: " + error);
        }
    },

    async getItemInfo(req, res) {
        // GET path: /items/962054832

        try {
            let sectorsVisibleForPublic = null;
            if (req.userPrivilege === "public") {
                // find only the sectors visible to public
                rawSectorObjects = await Sector.find({ visibleToPublic: true }, { sectorName: 1 });
                sectorsVisibleForPublic = rawSectorObjects.map((s) => s.sectorName);
            }

            const item = (await Item.aggregate([
                {
                    $match: {
                        cat: req.params.cat
                    }
                },
                // --- Accessories Logic ---
                {
                    $unwind: {
                        path: '$accessories',
                        preserveNullAndEmptyArrays: true
                    }
                }, {
                    $lookup: {
                        from: 'items',
                        localField: 'accessories.cat',
                        foreignField: 'cat',
                        as: 'accessories_image',
                        pipeline: [
                            { $project: { imageLink: 1 } }
                        ]
                    }
                }, {
                    $unwind: {
                        path: '$accessories_image',
                        preserveNullAndEmptyArrays: true
                    }
                }, {
                    $set: {
                        "accessories.imageLink": {
                            $cond: {
                                if: { $ne: [{ $type: "$accessories_image" }, "missing"] },
                                then: "$accessories_image.imageLink",
                                else: "$$REMOVE"
                            }
                        }
                    }
                },
                // --- Models Logic ---
                {
                    $unwind: {
                        path: '$models',
                        preserveNullAndEmptyArrays: true
                    }
                }, {
                    $lookup: {
                        from: 'items',
                        localField: 'models.cat',
                        foreignField: 'cat',
                        as: 'models_image',
                        pipeline: [
                            { $project: { imageLink: 1 } }
                        ]
                    }
                }, {
                    $unwind: {
                        path: '$models_image',
                        preserveNullAndEmptyArrays: true
                    }
                }, {
                    $set: {
                        "models.imageLink": {
                            $cond: {
                                if: { $ne: [{ $type: "$models_image" }, "missing"] },
                                then: "$models_image.imageLink",
                                else: "$$REMOVE"
                            }
                        }
                    }
                },
                // --- Consumables Logic ---
                {
                    $unwind: {
                        path: '$consumables',
                        preserveNullAndEmptyArrays: true
                    }
                }, {
                    $lookup: {
                        from: 'items',
                        localField: 'consumables.cat',
                        foreignField: 'cat',
                        as: 'consumables_image',
                        pipeline: [
                            { $project: { imageLink: 1 } }
                        ]
                    }
                }, {
                    $unwind: {
                        path: '$consumables_image',
                        preserveNullAndEmptyArrays: true
                    }
                }, {
                    $set: {
                        "consumables.imageLink": {
                            $cond: {
                                if: { $ne: [{ $type: "$consumables_image" }, "missing"] },
                                then: "$consumables_image.imageLink",
                                else: "$$REMOVE"
                            }
                        }
                    }
                },
                // --- KitItem Logic (NEWLY ADDED) ---
                {
                    $unwind: {
                        path: '$kitItem',
                        preserveNullAndEmptyArrays: true
                    }
                }, {
                    $lookup: {
                        from: 'items',
                        localField: 'kitItem.cat',
                        foreignField: 'cat',
                        as: 'kitItem_image',
                        pipeline: [
                            { $project: { imageLink: 1 } }
                        ]
                    }
                }, {
                    $unwind: {
                        path: '$kitItem_image',
                        preserveNullAndEmptyArrays: true
                    }
                }, {
                    $set: {
                        "kitItem.imageLink": {
                            $cond: {
                                if: { $ne: [{ $type: "$kitItem_image" }, "missing"] },
                                then: "$kitItem_image.imageLink",
                                else: "$$REMOVE"
                            }
                        }
                    }
                },
                // --- Grouping and Cleaning up ---
                {
                    $group: {
                        _id: '$_id',
                        accessories: { $push: '$accessories' },
                        models: { $push: '$models' },
                        consumables: { $push: '$consumables' },
                        kitItem: { $push: '$kitItem' }, // Add kitItem to group
                        _root: { $first: '$$ROOT' }
                    }
                },
                {
                    $set: {
                        accessories: {
                            $filter: {
                                input: "$accessories", as: "item", cond: { $and: [ { $ne: ["$$item.imageLink", null] }, { $ne: [{ $type: "$$item.imageLink" }, "missing"] } ] }
                            }
                        },
                        models: {
                            $filter: {
                                input: "$models", as: "item", cond: { $and: [ { $ne: ["$$item.imageLink", null] }, { $ne: [{ $type: "$$item.imageLink" }, "missing"] } ] }
                            }
                        },
                        consumables: {
                            $filter: {
                                input: "$consumables", as: "item", cond: { $and: [ { $ne: ["$$item.imageLink", null] }, { $ne: [{ $type: "$$item.imageLink" }, "missing"] } ] }
                            }
                        },
                        kitItem: { // Filter for kitItem
                            $filter: {
                                input: "$kitItem", as: "item", cond: { $and: [ { $ne: ["$$item.imageLink", null] }, { $ne: [{ $type: "$$item.imageLink" }, "missing"] } ] }
                            }
                        }
                    }
                },
                {
                    $replaceRoot: {
                        newRoot: {
                            $mergeObjects: [
                                '$_root',
                                {
                                    "_id": '$_id',
                                    "accessories": '$accessories',
                                    "models": '$models',
                                    "consumables": '$consumables',
                                    "kitItem": '$kitItem' // Add kitItem to root
                                }
                            ]
                        }
                    }
                },
                {
                    $project: {
                        accessories_image: 0,
                        models_image: 0,
                        consumables_image: 0,
                        kitItem_image: 0 // Remove temporary field
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
            console.error("Item fetch error: ", error);
            res.status(400).send("Item fetch error: " + error.message);
        }
    },

    async addItem(req, res) {
        // POST path: /items

        const { name, cat, sector, department, description, imageLink, qaStandardLink, catType, models, accessories, consumables, belongsToKits, similarItems, kitItem } = req.body;

        try {
            const newItem = await new Item({ name, cat, sector, department, description, imageLink, qaStandardLink, catType, models, accessories, consumables, belongsToKits, similarItems, kitItem }).save();

            // for each item in the "models" array, we need to add a reference to the new item in the "belongsToKits" array
            if (models && models.length > 0) {
                for (const model of models) {
                    await Item.findOneAndUpdate({ cat: model.cat }, { $push: { belongsToKits: { name: newItem.name, cat: newItem.cat } } });
                }
            }
            if (accessories && accessories.length > 0) {
                for (const accessory of accessories) {
                    await Item.findOneAndUpdate({ cat: accessory.cat }, { $push: { belongsToKits: { name: newItem.name, cat: newItem.cat } } });
                }
            }
            if (consumables && consumables.length > 0) {
                for (const consumable of consumables) {
                    await Item.findOneAndUpdate({ cat: consumable.cat }, { $push: { belongsToKits: { name: newItem.name, cat: newItem.cat } } });
                }
            }

            res.status(201).send(newItem);
        } catch (error) {
            if (error.code === 11000) {
                // duplicate key
                res.status(400).send("item creation error: " + `cat ${cat} already exists`);
            } else {
                res.status(400).send("item creation error: " + error);
            }
        }
    },

    async editItem(req, res) {
        // PUT path: /items/962054832

        try {
            const oldItem = await Item.findOne({ cat: req.params.cat });
            const newItem = await Item.findOneAndUpdate({ cat: req.params.cat }, req.body, { new: true });

            // compare oldItem.models and newItem.models and update belongsToKits accordingly
            const oldModels = oldItem.models.map(model => model.cat);
            const newModels = newItem.models.map(model => model.cat);
            const addedModels = newModels.filter(model => !oldModels.includes(model));
            const removedModels = oldModels.filter(model => !newModels.includes(model));
            for (const model of addedModels) {
                await Item.findOneAndUpdate({ cat: model }, { $push: { belongsToKits: { name: newItem.name, cat: newItem.cat } } });
            }
            for (const model of removedModels) {
                await Item.findOneAndUpdate({ cat: model }, { $pull: { belongsToKits: { cat: newItem.cat } } });
            }

            // same for accessories
            const oldAccessories = oldItem.accessories.map(accessory => accessory.cat);
            const newAccessories = newItem.accessories.map(accessory => accessory.cat);
            const addedAccessories = newAccessories.filter(accessory => !oldAccessories.includes(accessory));
            const removedAccessories = oldAccessories.filter(accessory => !newAccessories.includes(accessory));
            for (const accessory of addedAccessories) {
                await Item.findOneAndUpdate({ cat: accessory }, { $push: { belongsToKits: { name: newItem.name, cat: newItem.cat } } });
            }
            for (const accessory of removedAccessories) {
                await Item.findOneAndUpdate({ cat: accessory }, { $pull: { belongsToKits: { cat: newItem.cat } } });
            }

            // same for consumables
            const oldConsumables = oldItem.consumables.map(consumable => consumable.cat);
            const newConsumables = newItem.consumables.map(consumable => consumable.cat);
            const addedConsumables = newConsumables.filter(consumable => !oldConsumables.includes(consumable));
            const removedConsumables = oldConsumables.filter(consumable => !newConsumables.includes(consumable));
            for (const consumable of addedConsumables) {
                await Item.findOneAndUpdate({ cat: consumable }, { $push: { belongsToKits: { name: newItem.name, cat: newItem.cat } } });
            }
            for (const consumable of removedConsumables) {
                await Item.findOneAndUpdate({ cat: consumable }, { $pull: { belongsToKits: { cat: newItem.cat } } });
            }

            res.status(200).send(newItem);
        } catch (error) {
            res.status(400).send("item edit error: " + error);
        }
    },

    async deleteItem(req, res) {
        // DELETE path: /items/962054832

        try {
            const deletedItem = await Item.findOneAndDelete({ cat: req.params.cat });
            res.status(200).send(deletedItem);
        } catch (error) {
            res.status(400).send("item deletion error: " + error);
        }
    },
};
