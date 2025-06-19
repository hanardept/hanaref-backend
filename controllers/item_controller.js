// ... (keep the existing requires at the top of the file)
const Item = require("../models/Item");
const { decodeItems } = require("../functions/helpers");
const Sector = require("../models/Sector");

// ... (keep preliminaryItem function as is)
function preliminaryItem(item, sector, department) {
    return { name: item.name, cat: item.cat, sector: sector, department: department, imageLink: "" };
}

module.exports = {
    // ... (keep getItems function as is)
    async getItems(req, res) {
        // ... (your existing getItems code)
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
                // --- Accessories Logic (Existing) ---
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
                // --- Models Logic (NEW) ---
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
                // --- Consumables Logic (NEW) ---
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
                // --- Grouping and Cleaning up ---
                {
                    $group: {
                        _id: '$_id',
                        accessories: { $push: '$accessories' },
                        models: { $push: '$models' }, // Push models back into array
                        consumables: { $push: '$consumables' }, // Push consumables back into array
                        _root: { $first: '$$ROOT' }
                    }
                },
                {
                    $set: {
                        accessories: {
                            $filter: {
                                input: "$accessories",
                                as: "accessory",
                                cond: {
                                    $and: [
                                        { $ne: ["$$accessory.imageLink", null] },
                                        { $ne: [{ $type: "$$accessory.imageLink" }, "missing"] }
                                    ]
                                }
                            }
                        },
                        models: { // Filter for models
                            $filter: {
                                input: "$models",
                                as: "model",
                                cond: {
                                    $and: [
                                        { $ne: ["$$model.imageLink", null] },
                                        { $ne: [{ $type: "$$model.imageLink" }, "missing"] }
                                    ]
                                }
                            }
                        },
                        consumables: { // Filter for consumables
                            $filter: {
                                input: "$consumables",
                                as: "consumable",
                                cond: {
                                    $and: [
                                        { $ne: ["$$consumable.imageLink", null] },
                                        { $ne: [{ $type: "$$consumable.imageLink" }, "missing"] }
                                    ]
                                }
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
                                    "models": '$models', // Add models to the root
                                    "consumables": '$consumables' // Add consumables to the root
                                }
                            ]
                        }
                    }
                },
                {
                    $project: {
                        accessories_image: 0,
                        models_image: 0, // Remove temporary field
                        consumables_image: 0 // Remove temporary field
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
            console.error("Item fetch error: ", error); // Added console.error for better debugging
            res.status(400).send("Item fetch error: " + error.message); // Send error message to frontend
        }
    },

    // ... (keep addItem, editItem, deleteItem functions as is)
    async addItem(req, res) {
        // ... (your existing addItem code)
    },
    async editItem(req, res) {
        // ... (your existing editItem code)
    },
    async deleteItem(req, res) {
        // ... (your existing deleteItem code)
    },
};
