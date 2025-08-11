const Item = require("../models/Item");
const { decodeItems } = require("../functions/helpers");
const Sector = require("../models/Sector");
const ExcelJS = require('exceljs'); 
const mongoose = require("mongoose");
const Certification = require("../models/Certification");
const { ObjectId } = mongoose.Types;
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner")
const { S3Client, PutObjectCommand, DeleteObjectsCommand, ListObjectVersionsCommand } = require("@aws-sdk/client-s3");

function preliminaryItem(item, sector, department, catType = "מכשיר") {
    return { name: item.name, cat: item.cat, catType, sector: sector, department: department, imageLink: "" };
}

function prepareS3KeyFromLink(link) {
    console.log(`preparing link: ${link}`);
    const s3DomainEnding = '.amazonaws.com/';
    return decodeURI(link.substring(link.indexOf(s3DomainEnding) + s3DomainEnding.length));
}

async function deleteS3Objects(keys, client) {
    const params = {
        Bucket: process.env.BUCKET_NAME,
        Delete: {
            Objects: keys.map(key => ({ Key: key }))
        }
    };
    console.log(`deleting objects command params: ${JSON.stringify(params)}`);
    const command = new DeleteObjectsCommand(params);
    client = client ?? new S3Client({ apiVersion: '2006-03-01' });
    const res = await client.send(command);
    console.log(`delete objects result: ${JSON.stringify(res)}`);
}

module.exports = {
    async getItems(req, res) {
        // GET path: /items?search=jjo&sector=sj&department=wji&page=0
        // called via DEBOUNCE while entering Search word / choosing sector/dept
        const { search, searchFields, sector, department, status, catType, page = 0 } = req.query;
        const [decodedSearch, decodedSector, decodedDepartment, decodedCatType] = decodeItems(search, sector, department, catType);
        // privilege stored in req.userPrivilege ("public"/"hanar"/"admin")
        // currently we work in a binary fashion - "public" can see only public items, other privileges can see ALL items
        try {
            let sectorsVisibleForPublic = null;
            if (req.userPrivilege === "public") {
                // find only the sectors visible to public
                rawSectorObjects = await Sector.find({ visibleToPublic: true }, { sectorName: 1 });
                sectorsVisibleForPublic = rawSectorObjects.map((s) => s.sectorName);
            }

            const actualSearchFields = searchFields ?? [ 'name', 'cat', 'models.name', 'models.cat' ]

            const items = await Item.aggregate([
                {
                    $match: sectorsVisibleForPublic ? { sector: { $in: sectorsVisibleForPublic } } : {},
                },
                {
                    $match: search
                        ? {
                              $or: [
                                  actualSearchFields.includes('name') && { name: { $regex: decodedSearch, $options: "i" } },
                                  actualSearchFields.includes('cat') && { cat: { $regex: decodedSearch } },
                                  actualSearchFields.includes('models.name') && { "models.name": { $regex: decodedSearch, $options: "i" } },
                                  actualSearchFields.includes('models.cat') && { "models.cat": { $regex: decodedSearch, $options: "i" } },
                              ].filter(Boolean),
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
                    $match: catType ? { catType: decodedCatType } : {},
                },                
                {
                    $match: status !== 'all' ? { archived: {$ne: true} } : {},
                },
                {
                    $project: { name: 1, cat: 1, _id: 1, imageLink: 1, archived: 1, certificationPeriodMonths: 1  },
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
            name, cat, kitCats, sector, department, catType, certificationPeriodMonths, description, imageLink, qaStandardLink, medicalEngineeringManualLink, models, accessories, consumables, spareParts, belongsToDevices, similarItems, kitItem,
            hebrewManualLink, serviceManualLink, userManualLink, supplier, lifeSpan
        } = req.body;

        const newItem = new Item({
            name, cat, kitCats, sector, department, catType, certificationPeriodMonths, description, imageLink, qaStandardLink, medicalEngineeringManualLink, models, accessories, consumables, spareParts, belongsToDevices, similarItems, kitItem,
            hebrewManualLink, serviceManualLink, userManualLink, supplier, lifeSpan
        });

        try {
            const catAlreadyExists = await Item.findOne({ cat: cat });
            if (catAlreadyExists) return res.status(400).send({ errorMsg: "This catalog number is already in the database." });

            const mongoInsertPromises = [newItem.save()];

            if (accessories && accessories.length > 0)
                accessories.forEach((a) => {
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: a.cat }, { $setOnInsert: preliminaryItem(a, sector, department, "אביזר") }, { upsert: true })
                    );
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: a.cat }, { $addToSet: { belongsToDevices: { name, cat } } })
                    );
                });
            if (consumables && consumables.length > 0)
                consumables.forEach((c) => {
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: c.cat }, { $setOnInsert: preliminaryItem(c, sector, department, "מתכלה") }, { upsert: true })
                    );
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: c.cat }, { $addToSet: { belongsToDevices: { name, cat } } })
                    );
                });
            if (spareParts && spareParts.length > 0)
                spareParts.forEach((c) => {
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: c.cat }, { $setOnInsert: preliminaryItem(c, sector, department, "חלק חילוף") }, { upsert: true })
                    );
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: c.cat }, { $addToSet: { belongsToDevices: { name, cat } } })
                    );
                });                
            if (belongsToDevices && belongsToDevices.length > 0)
                belongsToDevices.forEach((b) => {
                    const { catType } = req.body;
                    let listType;

                    switch (catType) {
                        case "אביזר":
                            listType = "accessories";
                            break;
                        case "מתכלה":
                            listType = "consumables";
                            break;
                        case "חלק חילוף":
                            listType = "spareParts";
                        default:
                            listType = "kitItem";
                            break;
                    }

                    mongoInsertPromises.push(
                        Item.updateOne({ cat: b.cat }, { $setOnInsert: preliminaryItem(b, sector, department) }, { upsert: true })
                    );
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: b.cat }, { $addToSet: { [listType]: { name, cat } } })
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
                    )
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: i.cat }, { $addToSet: { belongsToDevices: { name, cat } } })
                    );
                });

            await Promise.all(mongoInsertPromises);
            res.status(200).send("Item saved successfully!");
        } catch (error) {
            res.status(400).send(`Failure saving item: ${error}`);
        }   
    },

    async editItem(req, res) {
        // PUT path: /items/962780438
        const {
            name, cat, kitCats, sector, department, catType, certificationPeriodMonths, description, imageLink, qaStandardLink, medicalEngineeringManualLink, models, accessories, consumables, spareParts, belongsToDevices, similarItems, kitItem,
            hebrewManualLink, serviceManualLink, userManualLink, supplier, lifeSpan
        } = req.body;        

        try {
            const updateOwnItem = Item.findOneAndUpdate(
                { cat: req.params.cat },
                { 
                    name, cat, kitCats, sector, department, catType, certificationPeriodMonths, description, imageLink, qaStandardLink, medicalEngineeringManualLink, models, accessories, consumables, spareParts, belongsToDevices, similarItems, kitItem,
                    hebrewManualLink, serviceManualLink, userManualLink, supplier, lifeSpan
                },
                { returnOriginal: true }
            ).then(original => {
                const linkFields = [ 'imageLink', 'qaStandardLink', 'medicalEngineeringManualLink', 'hebrewManualLink', 'serviceManualLink', 'userManualLink' ];
                const s3ObjectsToDelete = linkFields
                    .filter(link => original[link]?.length && (req.body[link] !== original[link]) && !linkFields.some(field => original[link] === req.body[field] ))
                    .map(link => prepareS3KeyFromLink(original[link]));
                //console.log(`s3 objects to delete: ${JSON.stringify(linkFields.filter(link => original[link]?.length && (req.body[link] !== original[link])).map(link => ({ old: prepareS3KeyFromLink(original[link]), new: prepareS3KeyFromLink(req.body[link ])})))}`);
                console.log(`s3 objects to delete: ${s3ObjectsToDelete}`);
                if (s3ObjectsToDelete.length) {
                    deleteS3Objects(s3ObjectsToDelete);
                }
            });

            const mongoInsertPromises = [updateOwnItem];
            
            if (accessories && accessories.length > 0)
                accessories.forEach((a) => {
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: a.cat }, { $setOnInsert: preliminaryItem(a, sector, department, "אביזר") }, { upsert: true })
                    );
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: a.cat }, { $addToSet: { belongsToDevices: { name: req.body.name, cat: req.body.cat } } })
                    );
                });
            if (consumables && consumables.length > 0)
                consumables.forEach((c) => {
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: c.cat }, { $setOnInsert: preliminaryItem(c, sector, department, "מתכלה") }, { upsert: true })
                    );
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: c.cat }, { $addToSet: { belongsToDevices: { name: req.body.name, cat: req.body.cat } } })
                    );
                });
            if (spareParts && spareParts.length > 0)
                spareParts.forEach((c) => {
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: c.cat }, { $setOnInsert: preliminaryItem(c, sector, department, "חלק חילוף") }, { upsert: true })
                    );
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: c.cat }, { $addToSet: { belongsToDevices: { name: req.body.name, cat: req.body.cat } } })
                    );
                });                
            if (belongsToDevices && belongsToDevices.length > 0)
                belongsToDevices.forEach((b) => {
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
                        Item.updateOne({ cat: i.cat }, { $addToSet: { belongsToDevices: { name: req.body.name, cat: req.body.cat } } })
                    );
                });

            await Promise.all(mongoInsertPromises);
            res.status(200).send("Item updated successfully!");
        } catch (error) {
            res.status(400).send(`Failure updating item: ${error}`);
        }
    },
    
    async deleteItem(req, res) {
        // DELETE path: /items/962780438
        try {
            let removed = await Item.findOne({ cat: req.params.cat });

            try {
                const objects = [ removed.imageLink, removed.userManualLink, removed.serviceManualLink, removed.hebrewManualLink, removed.qaStandardLink, removed.medicalEngineeringManualLink ]
                    .filter(link => link?.length)
                    .map(link => prepareS3KeyFromLink(link));
                console.log(`deleting links: ${JSON.stringify(objects)}`);

                if (objects.length) {
                    const client = new S3Client({ apiVersion: '2006-03-01' });

                    const prefix = objects[0].substring(0, objects[0].lastIndexOf('/') + 1);
                    console.log(`fetching objects with prefix: ${prefix}`)
                    const verionsParams = {
                        Bucket: process.env.BUCKET_NAME,
                        Prefix: prefix
                    };
                    const versionsCommand = new ListObjectVersionsCommand(verionsParams);
                    const versionsRes = await client.send(versionsCommand);
                    console.log(`versions objects result: ${JSON.stringify(versionsRes)}`);

                    await deleteS3Objects(objects, client);
                }

            } catch(error) {
                console.log(`Error deleting s3 objects for item cat ${req.params.cat}: ${error}`);
                throw error;
            }

             try {
                await Certification.deleteMany({ item: new ObjectId(removed._id)})
            } catch (error) {
                console.log(`Error deleting certifications for item cat ${req.params.cat}: ${error}`);
                throw error;
            }

            await Item.findOneAndRemove({ cat: req.params.cat });

            res.status(200).send("Item removed successfully!");
        } catch (error) {
            console.error(`Error removing item: ${error}`);
            res.status(400).send(`Failure removing item: ${error}`);

        }
    },

    toggleArchive: async (req, res) => {
        try {
            // We use req.params.cat to find the item, following your app's convention.
            const item = await Item.findOne({ cat: req.params.cat });

            if (!item) {
                return res.status(404).send('Item not found.');
            }

            // This is the core logic: it flips the boolean value.
            const newArchiveStatus = !item.archived;
            item.archived = newArchiveStatus;
            await Promise.all([
                item.save(),
                Certification.updateMany({ item: item._id }, { $set: { archived: newArchiveStatus } })
            ]);

            // Send the updated item back to the frontend.
            res.status(200).json(item);

        } catch (error) {
            console.error(`Error toggling archive for item ${req.params.cat}:`, error);
            res.status(500).send('A server error occurred.');
        }
    }, 

    async createFileUploadUrl(req, res) {
        try {
            const item = await Item.findOne({ cat: req.params.cat}, { cat: 1, name: 1, sector: 1, department: 1 });
            if (!item) {
                return res.status(404).send('Item not found.');
            }
            console.log(`item: ${JSON.stringify(item)}`);
            const client = new S3Client({ apiVersion: '2006-03-01' });
            const { cat, name, sector, department } = item;
            const params = {
                Bucket: process.env.BUCKET_NAME,
                Key: `${sector}/${department}/${cat} - ${name}/${req.body.filename}`,
                ContentType: req.body.contentType,
            };
            const command = new PutObjectCommand(params);
            const url = await getSignedUrl(client, command, { expiresIn: 3600 });
            res.status(200).json({ url });
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
            header: 'מק"טי ערכה',
            key: 'kitCats',
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
            header: 'תקופת הסמכה בחודשים',
            certificationPeriodMonths: 'certificationPeriodMonths',
            width: 10,
        }, {
            header: 'יצרן',
            key: 'supplier',
            width: 25,
        }, {
            header: 'אורך חיים',
            key: 'lifeSpan',
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
            header: 'הוראות הנר',
            key: 'medicalEngineeringManualLink',
            width: 30
        },{
            header: 'הוראות הפעלה בעברית',
            key: 'hebrewManualLink',
            width: 30
        }, {
            header: 'Service Manual',
            key: 'serviceManualLink',
            width: 30
        }, {
            header: 'מדריך למשתמש',
            key: 'userManualLink',
            width: 30
        }, {
            header: 'בארכיון',
            key: 'archived',
            width: 10
        }, {
            header: 'שייך למכשירים',
            key: 'belongsToDevices',
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
            items = await Item.find({}, { 
                    name: 1, cat: 1, kitCats: 1, sector: 1, department: 1, models: 1, archived: 1, catType: 1, certificationPeriodMonths: 1, description: 1, imageLink: 1, qaStandardLink: 1, medicalEngineeringManualLink: 1, 
                    serviceManualLink: 1, userManualLink: 1, hebrewManualLink: 1, supplier: 1, lifeSpan: 1, belongsToDevices: 1, similarItems: 1, kitItem: 1 
                })
                .sort('cat')
                .skip(offset)
                .limit(batchSize);
            if (items?.length) {
                worksheet.addRows(items.map(({ 
                    name, cat, kitCats, sector, department, models, catType, certificationPeriodMonths, description, imageLink, qaStandardLink, medicalEngineeringManualLink, serviceManualLink, userManualLink,
                    hebrewManualLink, archived, belongsToDevices, similarItems, supplier, lifeSpan,
                }) => (
                    { 
                        name, cat, sector, department, models, catType, certificationPeriodMonths, description, imageLink, qaStandardLink, medicalEngineeringManualLink, serviceManualLink, userManualLink, 
                        hebrewManualLink, supplier, lifeSpan,
                        kitCats: kitCats?.join('\r\n'),
                        archived: archived ? 'כן' : 'לא',
                        belongsToDevices: belongsToDevices?.map(b => b.cat).join('\r\n'),
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
