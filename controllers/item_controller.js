const Item = require("../models/Item");
const { decodeItems } = require("../functions/helpers");
const Sector = require("../models/Sector");

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
                    $project: { name: 1, cat: 1, _id: 1 },
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

            const item = await Item.findOne({ cat: req.params.cat });

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
            if (catAlreadyExists) return res.status(400).send("This catalog number is already in the database.");

            await newItem.save();
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
            await Item.findOneAndUpdate(
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
