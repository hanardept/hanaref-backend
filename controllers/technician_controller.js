const Technician = require("../models/Technician");
const { decodeItems } = require("../functions/helpers");
const Sector = require("../models/Sector");
const ExcelJS = require('exceljs'); 

function preliminaryItem(item, sector, department) {
    return { name: item.name, cat: item.cat, sector: sector, department: department, imageLink: "" };
}

module.exports = {
    async getTechnicians(req, res) {
        // GET path: /items?search=jjo&sector=sj&department=wji&page=0
        // called via DEBOUNCE while entering Search word / choosing sector/dept
        const { search, page = 0 } = req.query;
        const [decodedSearch] = decodeItems(search);
        // privilege stored in req.userPrivilege ("public"/"hanar"/"admin")
        // currently we work in a binary fashion - "public" can see only public items, other privileges can see ALL items
        try {

            const technicians = await Technician
                .find(search
                    ? {
                            $or: [
                                { firstName: { $regex: decodedSearch, $options: "i" } },
                                { lastName: { $regex: decodedSearch, $options: "i" } },
                            ],
                        }
                    : {},
                    { firstName: 1, lastName: 1, _id: 1 },
                )
                .sort("firstName")
                .skip(page * 20)
                .limit(20);
            res.status(200).send(technicians);
        } catch (error) {
            res.status(400).send(`Error fetching technicians: ${error}`);
        }
    },

    async getTechnicianInfo(req, res) {
        try {

            const technician = await Technician.findById(req.params.id,
                { id: 1, firstName: 1, lastName: 1)

            if (technician) {
                res.status(200).send(item);
            } else {
                res.status(404).send("Technician could not be found in database");
            }
        } catch (error) {
            res.status(400).send("Technician fetch error: ", error);
        }
    },

    // admin-only controllers:
    async addTechnician(req, res) {
        // POST path: /technicians
        const {
            firstName, lastName
        } = req.body;

        const newTechnician = new Technician({
            firstName, lastName
        });

        try {  
            await newTechnician.save();
            res.status(200).send("Technician saved successfully!");
        } catch (error) {
            res.status(400).send("Failure saving technician: ", error);
        }
    },

    async editTechnician(req, res) {
        // PUT path: /technicians/962780438
        const {
            firstName, lastName
        } = req.body;

        try {
            const update^ = Technician.findByIdAndUpdate(req.params.id,
                { firstName, lastName }
            );

            const mongoInsertPromises = [updateOwnItem];
            
            if (accessories && accessories.length > 0)
                accessories.forEach((a) => {
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: a.cat }, { $setOnInsert: preliminaryItem(a, sector, department) }, { upsert: true })
                    );
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: a.cat }, { $addToSet: { belongsToKits: { name: req.body.name, cat: req.body.cat } } })
                    );
                });
            if (consumables && consumables.length > 0)
                consumables.forEach((c) => {
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: c.cat }, { $setOnInsert: preliminaryItem(c, sector, department) }, { upsert: true })
                    );
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: c.cat }, { $addToSet: { belongsToKits: { name: req.body.name, cat: req.body.cat } } })
                    );
                });
            if (belongsToKits && belongsToKits.length > 0)
                belongsToKits.forEach((b) => {
                    const { catType } = req.body;
                    let listType;

                    switch (catType) {
                        case "אביזר":
                            listType = "accessories";
                            break;
                        case "מתכלה":
                            listType = "consumables";
                            break;
                        default:
                            listType = "kitItem";
                            break;
                    }
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: b.cat }, { $setOnInsert: preliminaryItem(b, sector, department) }, { upsert: true })
                    );
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: b.cat }, { $addToSet: { [listType]: { name: req.body.name, cat: req.body.cat } } })
                    );
                });
            if (similarItems && similarItems.length > 0)
                similarItems.forEach((s) =>
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: s.cat }, { $setOnInsert: preliminaryItem(s, sector, department) }, { upsert: true })
                    )
                );
            if (kitItem && kitItem.length > 0)
                kitItem.forEach((i) => {
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: i.cat }, { $setOnInsert: preliminaryItem(i, sector, department) }, { upsert: true })
                    );
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: i.cat }, { $addToSet: { belongsToKits: { name: req.body.name, cat: req.body.cat } } })
                    );
                });

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
    
    async getItemsWorksheet(req, res) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Items');

        console.log(`Generating Excel worksheet for items...`);

        worksheet.columns = [{
            header: 'שם',
            key: 'name',
            width: 30
        }, {
            header: 'מק"ט',
            key: 'cat',
            width: 15
        }, {
            header: 'מדור',
            key: 'sector',
            width: 20
        }, {
            header: 'תחום',
            key: 'department',
            width: 10
        }, {
            header: 'סוג מק"ט',
            key: 'catType',
            width: 10
        }, {
            header: 'מק"ט יצרן',
            key: 'manufacturerCat',
            width: 30,
            style: { alignment: { wrapText: true, horizontal: 'right', readingOrder: 'rtl' } }
        }, {
            header: 'דגם',
            key: 'models',
            width: 30,
            style: { alignment: { wrapText: true, horizontal: 'right', readingOrder: 'rtl' } }
        }, {
            header: 'תיאור',
            key: 'description',
            width: 40
        }, {
            header: 'קישור לתמונה',
            key: 'imageLink',
            width: 30
        }, {
            header: 'קישור לתקן בחינה',
            key: 'qaStandardLink',
            width: 30
        }, {
            header: 'בארכיון',
            key: 'archived',
            width: 10
        }, {
            header: 'שייך לערכות',
            key: 'belongsToKits',
            width: 30
        }, {
            header: 'פריטים דומים',
            key: 'similarItems',
            width: 30
        }];

        let items;
        let offset = 0;
        const batchSize = 500;
        do {
            items = await Item.find({}, { name: 1, cat: 1, sector: 1, department: 1, models: 1, archived: 1, catType: 1, description: 1, imageLink: 1, qaStandardLink: 1, belongsToKits: 1, similarItems: 1, kitItem: 1 })
                .sort('cat')
                .skip(offset)
                .limit(batchSize);
            if (items?.length) {
                worksheet.addRows(items.map(({ name, cat, sector, department, models, catType, description, imageLink, qaStandardLink, archived, belongsToKits, similarItems }) => (
                    { name, cat, sector, department, models, catType, description, imageLink, qaStandardLink,
                        archived: archived ? 'כן' : 'לא',
                        belongsToKits: belongsToKits?.map(b => b.cat).join('\r\n'),
                        similarItems: similarItems?.map(b => b.cat).join('\r\n'),
                        manufacturerCat: models?.map(m => m.cat).join('\r\n'),
                        models: models?.map(m => m.name).join('\r\n'),
                    }
                )));
            }
            offset += batchSize;
        } while (items.length > 0);

        // Set the response headers
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=' + 'items.xlsx'
        );

        try {
            await workbook.xlsx.write(res);
            res.end();
        } catch (error) {
            console.error('Error sending Excel file:', error);
            res.status(500).send('Error sending Excel file');
        }
    }
};
