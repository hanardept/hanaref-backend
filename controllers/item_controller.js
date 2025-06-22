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
        const { search, sector, department, page = 0 } = req.query;
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
                    $project: { name: 1, cat: 1, _id: 1, imageLink: 1 },
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
            }, {
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
                        {
                            $project: {
                                imageLink: 1
                            }
                        }
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
                            if: { $ne: [ { $type: "$accessories_image" }, "missing" ] },
                            then: "$accessories_image.imageLink",
                            else: "$$REMOVE"
                        }
                    }
                }
            },
            {
                $group: {
                    _id: '$_id', 
                    accessories: {
                        $push: {
                            _id: '$accessories._id', 
                            cat: '$accessories.cat', 
                            imageLink: '$accessories.imageLink', 
                            name: '$accessories.name'
                        }
                    }, 
                    _root: {
                        $first: '$$ROOT'
                    }
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
                                    { $ne: [ "$$accessory.imageLink",  null ]},
                                    { $ne: [ { $type: "$$accessory.imageLink" }, "missing" ] }
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
                            '$_root', {
                                "_id": '$_id', 
                                "accessories": '$accessories'
                            }
                        ]
                    }
                }
            },
            {
                $project: {
                    accessories_image: 0
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
            name,
            cat,
            sector,
            department,
            catType,
            description,
            imageLink,
            qaStandardLink,
            models,
            accessories,
            consumables,
            belongsToKits,
            similarItems,
            kitItem,
        } = req.body;

        const newItem = new Item({
            name: name,
            cat: cat,
            sector: sector,
            department: department,
            catType: catType,
            description: description,
            imageLink: imageLink,
            qaStandardLink: qaStandardLink,
            models: models,
            accessories: accessories,
            consumables: consumables,
            belongsToKits: belongsToKits,
            similarItems: similarItems,
            kitItem: kitItem,
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
                        Item.updateOne({ cat: i.cat }, { $setOnInsert: preliminaryItem(i, sector, department) }, { upsert: true })
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
            name,
            cat,
            sector,
            department,
            catType,
            description,
            imageLink,
            qaStandardLink,
            models,
            accessories,
            consumables,
            belongsToKits,
            similarItems,
            kitItem,
        } = req.body;

        try {
            const updateOwnItem = Item.findOneAndUpdate(
                { cat: req.params.cat },
                {
                    name: name,
                    cat: cat,
                    sector: sector,
                    department: department,
                    catType: catType,
                    description: description,
                    imageLink: imageLink,
                    qaStandardLink: qaStandardLink,
                    models: models,
                    accessories: accessories,
                    consumables: consumables,
                    belongsToKits: belongsToKits,
                    similarItems: similarItems,
                    kitItem: kitItem,
                }
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
};
