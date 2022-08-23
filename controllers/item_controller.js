const Item = require('../models/Item');

module.exports = {
    async getItems(req, res) {
        // GET path: /items?search=jjo&sector=sj&department=wji
        // called via DEBOUNCE while entering Search word / choosing sector/dept
        const { search, sector, department } = req.query;
        
        

    },
    async getItemInfo(req, res) {
        // GET path: /items/962054832

        try {
            const item = await Item.findById(req.params.cat);
            if (item) {
                res.status(200).send(item);
            } else {
                res.status(404).send("Item could not be found in database");
            }
        } catch (error) {
            res.status(400).send("Item fetch error: ", error);
        }
    },
    async addItem(req, res) {
        // POST path: /items
        const { name,
            cat,
            sector,
            department,
            catType,
            description,
            imageLink,
            accessories,
            consumables,
            belongsToKits,
            similarItems,
            kitItem } = req.body;
        const visibleTo = sector === "בחינה" ? "p1" : "all";
        
        const newItem = new Item({
            name: name,
            cat: cat,
            sector: sector,
            department: department,
            catType: catType,
            description: description,
            imageLink: imageLink,
            accessories: accessories,
            consumables: consumables,
            belongsToKits: belongsToKits,
            similarItems: similarItems,
            kitItem: kitItem,
            visibleTo: visibleTo
        });

        try {
            await newItem.save();
            res.status(200).send("Item saved successfully!")
        } catch (error) {
            res.status(400).send("Failure saving item: ", error);
        }
    },
    async editItem(req, res) {
        // PUT path: /items/962780438
        const { name,
            cat,
            sector,
            department,
            catType,
            description,
            imageLink,
            accessories,
            consumables,
            belongsToKits,
            similarItems,
            kitItem } = req.body;
        const visibleTo = sector === "בחינה" ? "p1" : "all";

        try {
            await Item.findByIdAndUpdate(req.params.cat, {
                name: name,
                cat: cat,
                sector: sector,
                department: department,
                catType: catType,
                description: description,
                imageLink: imageLink,
                accessories: accessories,
                consumables: consumables,
                belongsToKits: belongsToKits,
                similarItems: similarItems,
                kitItem: kitItem,
                visibleTo: visibleTo
            });
            res.status(200).send("Item updated successfully!");
        } catch (error) {
            res.status(400).send("Failure updating item: ", error);
        }
    },
    async deleteItem(req, res) {
        // DELETE path: /items/962780438
        try {
            await Item.findByIdAndRemove(req.params.cat);
            res.status(200).send("Item removed successfully!");
        } catch (error) {
            
        }
    }
};