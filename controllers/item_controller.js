const Item = require("../models/Item");
const { itemPrivileges } = require("../rules/privileges");

module.exports = {
    async getItems(req, res) {
        // GET path: /items?search=jjo&sector=sj&department=wji&page=0
        // called via DEBOUNCE while entering Search word / choosing sector/dept
        const { search, sector, department, page = 0 } = req.query;

        // privilege stored in req.userPrivilege
        // privilege "admin" and "hanar" can view everything
        // privilege "public" can view everything but b7ina & bimal
        try {
            const items = await Item.aggregate([
                {
                    $match: { sector: { $in: itemPrivileges[req.userPrivilege] } },
                },
                {
                    $unwind: { path: "$models", preserveNullAndEmptyArrays: true },
                },
                {
                    $match: search
                        ? {
                              $or: [
                                  { name: { $regex: search, $options: "i" } },
                                  { cat: { $regex: search } },
                                  { "models.name": { $regex: search, $options: "i" } },
                                  { "models.cat": { $regex: search, $options: "i" } },
                              ],
                          }
                        : {},
                },
                {
                    $match: sector ? { sector: sector } : {},
                },
                {
                    $match: department ? { department: department } : {},
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
            const item = await Item.findOne({ cat: req.params.cat });

            if (item) {
                if (!itemPrivileges[req.userPrivilege].includes(item.sector)) {
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
