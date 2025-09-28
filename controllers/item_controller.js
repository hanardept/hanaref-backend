const Item = require("../models/Item");
const Supplier = require("../models/Supplier");
const { decodeItems } = require("../functions/helpers");
const Sector = require("../models/Sector");
const Role = require("../models/Role");
const ExcelJS = require('exceljs'); 
const mongoose = require("mongoose");
const Certification = require("../models/Certification");
const { ObjectId } = mongoose.Types;
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner")
const { S3Client, PutObjectCommand, DeleteObjectsCommand, ListObjectVersionsCommand } = require("@aws-sdk/client-s3");

function preliminaryItem(item, sector, department, catType = "מכשיר", belongsToDevice = undefined) {
    return { name: item.name, cat: item.cat, catType, sector: sector, department: department, imageLink: "" };
}

const filteredFieldsForRole = {
    [Role.Viewer]: [ 'certificationPeriodMonths', 'qaStandardLink', 'serviceManualLink' ],
}

function catTypeToChildrenArray(catType) {
    switch(catType) {
        case 'אביזר':
            return device => device.accessories;
        case 'מתכלה':
            return device => device.consumables;
        case 'חלק חילוף':
            return device => device.spareParts;
        default:
            return null;
    }
}

function catTypeToChildrenArrayField(catType) {
    switch (catType) {
        case "אביזר":
            return "accessories";
        case "מתכלה":
            return "consumables";
        case "חלק חילוף":
            return "spareParts";
        default:
            return null;
    }
}

const worksheetColumns = [{
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
    header: 'ספק',
    key: 'supplier',
    width: 25,
}, {
    header: 'מספר ספק במשרד הביטחון',
    key: 'supplierId',
    width: 25,
}, {
    header: 'אורך חיים',
    key: 'lifeSpan',
}, {
    header: 'יצרן',
    key: 'manufacturer',
    width: 30,
    style: { alignment: { wrapText: true, horizontal: 'right', readingOrder: 'rtl' } }
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
    header: 'חירום',
    key: 'emergency',
    width: 10
}, {
    header: 'בארכיון',
    key: 'archived',
    width: 10
}, {
    header: 'שייך למכשירים',
    key: 'belongsToDevices',
    width: 30
}];

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
        const role = req.userPrivilege;
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

            const actualSearchFields = searchFields ?? [ 'name', 'cat', 'models.name', 'models.cat', 'kitCats' ]

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
                                  actualSearchFields.includes('kitCats') && { kitCats: { $regex: decodedSearch } },
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
                    $project:
                        [ 'name', 'cat', 'kitCats', 'catType', '_id', 'imageLink', 'archived', 'certificationPeriodMonths' ]
                            .filter(field => !(filteredFieldsForRole[role] ?? []).includes(field))
                            .reduce((obj, field) => ({ ...obj, [field]: 1 }) , {})
                },
            ])
                .sort("name")
                .skip(page * 20)
                .limit(20);
            
            res.status(200).send(items);
        } catch (error) {
            console.log(`Error fetching items: ${error}`);
            res.status(400).send(`Error fetching items: ${error}`);
        }
    },

    async getItemInfo(req, res) {
        const role = req.userPrivilege;

        // THIS FUNCTION HAS BEEN CORRECTED TO FIX THE DUPLICATION ISSUE
        try {
            let sectorsVisibleForPublic = null;
            if (req.userPrivilege === "public") {
                // find only the sectors visible to public
                rawSectorObjects = await Sector.find({ visibleToPublic: true }, { sectorName: 1 });
                sectorsVisibleForPublic = rawSectorObjects.map((s) => s.sectorName);
            }

            let item = (await Item.aggregate([
                { $match: { cat: req.params.cat } },
                { $unwind: { path: '$accessories', preserveNullAndEmptyArrays: true } },
                { $lookup: { from: 'items', localField: 'accessories.cat', foreignField: 'cat', as: 'accessories_details', pipeline: [{ $project: { name: 1, imageLink: 1 } }] } },
                { $unwind: { path: '$accessories_details', preserveNullAndEmptyArrays: true } },
                { $set: { "accessories.imageLink": { $cond: { if: { $ne: [{ $type: "$accessories_details" }, "missing"] }, then: "$accessories_details.imageLink", else: "$$REMOVE" } } } },
                { $set: { "accessories.name": { $cond: { if: { $ne: [{ $type: "$accessories_details" }, "missing"] }, then: "$accessories_details.name", else: "$$REMOVE" } } } },
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
                { $lookup: { from: 'items', localField: 'consumables.cat', foreignField: 'cat', as: 'consumables_details', pipeline: [{ $project: { name: 1, imageLink: 1 } }] } },
                { $unwind: { path: '$consumables_details', preserveNullAndEmptyArrays: true } },
                { $set: { "consumables.imageLink": { $cond: { if: { $ne: [{ $type: "$consumables_details" }, "missing"] }, then: "$consumables_details.imageLink", else: "$$REMOVE" } } } },
                { $set: { "consumables.name": { $cond: { if: { $ne: [{ $type: "$consumables_details" }, "missing"] }, then: "$consumables_details.name", else: "$$REMOVE" } } } },
                {
                    $group: {
                        _id: '$_id',
                        consumables: { $addToSet: '$consumables' },
                        root: { $first: '$$ROOT' }
                    }
                },
                { $replaceRoot: { newRoot: { $mergeObjects: ["$root", { consumables: "$consumables" }] } } },

                { $unwind: { path: '$spareParts', preserveNullAndEmptyArrays: true } },
                { $lookup: { from: 'items', localField: 'spareParts.cat', foreignField: 'cat', as: 'spareParts_details', pipeline: [{ $project: { name: 1, imageLink: 1 } }] } },
                { $unwind: { path: '$spareParts_details', preserveNullAndEmptyArrays: true } },
                { $set: { "spareParts.imageLink": { $cond: { if: { $ne: [{ $type: "$spareParts_details" }, "missing"] }, then: "$spareParts_details.imageLink", else: "$$REMOVE" } } } },
                { $set: { "spareParts.name": { $cond: { if: { $ne: [{ $type: "$spareParts_details" }, "missing"] }, then: "$spareParts_details.name", else: "$$REMOVE" } } } },
                {
                    $group: {
                        _id: '$_id',
                        spareParts: { $addToSet: '$spareParts' },
                        root: { $first: '$$ROOT' }
                    }
                },
                { $replaceRoot: { newRoot: { $mergeObjects: ["$root", { spareParts: "$spareParts" }] } } },

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
                        consumables: { $filter: { input: "$consumables", as: "item", cond: { $and: [ { $ne: ["$$item.cat", null] }, { $ne: [{ $type: "$$item.cat" }, "missing"] } ] } } },
                        spareParts: { $filter: { input: "$spareParts", as: "item", cond: { $and: [ { $ne: ["$$item.cat", null] }, { $ne: [{ $type: "$$item.cat" }, "missing"] } ] } } },
                        kitItem: { $filter: { input: "$kitItem", as: "item", cond: { $and: [ { $ne: ["$$item.name", null] }, { $ne: [{ $type: "$$item.name" }, "missing"] } ] } } }
                    }
                },
                {
                    $project: {
                        root: 0,
                        accessories_details: 0,
                        models_image: 0,
                        consumables_details: 0,
                        spareParts_details: 0,
                        kitItem_image: 0,
                        ...(filteredFieldsForRole[role] ?? []).reduce((obj, field) => ({ ...obj, [field]: 0 }) , {})
                    }
                }
            ]))?.[0];

            if (item) {
                if (req.userPrivilege === "public" && !sectorsVisibleForPublic.includes(item.sector)) {
                    return res.status(401).send("You are not authorized to view this item.");
                }

                const promises = [];
                if (item.supplier) {
                    promises.push(Item.populate(item, { path: 'supplier', select: '_id id name' }));
                }

                const parentDevices = item.belongsToDevices;
                if (parentDevices?.length) {
                    promises.push(Item
                        .find({ 
                            cat: { $in: parentDevices.map(d => d.cat) },
                        }, { cat: 1, supplier: 1, name: 1 })
                        .populate('supplier', '_id id name')
                        .then(parentDevicesWithSupplier => {
                            for (const parentDevice of parentDevices) {
                                const parentDeviceDetails = parentDevicesWithSupplier.find(pd => pd.cat === parentDevice.cat);
                                if (parentDeviceDetails) {
                                    parentDevice.name = parentDeviceDetails.name;
                                    parentDevice.supplier = parentDeviceDetails.supplier
                                }
                            }
                        }));
                }

                await Promise.all(promises);

                res.status(200).send(item);
            } else {
                res.status(404).send("Item could not be found in database");
            }
        } catch (error) {
            console.log(`Item fetch error: ${error}`);
            res.status(400).send(`Item fetch error: ${error}`);
        }
    },

    // admin-only controllers:
    async addItem(req, res) {
        // POST path: /items
        const {
            name, cat, kitCats, sector, department, catType, certificationPeriodMonths, description, imageLink, qaStandardLink, medicalEngineeringManualLink, models, accessories, consumables, spareParts, belongsToDevices, similarItems, kitItem,
            hebrewManualLink, serviceManualLink, userManualLink, emergency, supplier, lifeSpan
        } = req.body;

        const newItem = new Item({
            name, cat, kitCats, sector, department, catType, certificationPeriodMonths, description, imageLink, qaStandardLink, medicalEngineeringManualLink, models, accessories, consumables, spareParts, belongsToDevices, similarItems, kitItem,
            hebrewManualLink, serviceManualLink, userManualLink, emergency, supplier, lifeSpan
        });

        

        try {
            const catAlreadyExists = await Item.findOne({ cat: cat });
            if (catAlreadyExists) return res.status(400).send({ errorMsg: "This catalog number is already in the database." });

            const belongsToDevice = { name, cat };
            const mongoInsertPromises = [newItem.save()];

            if (accessories && accessories.length > 0)
                accessories.forEach((a) => {
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: a.cat }, { $setOnInsert: preliminaryItem(a, sector, department, "אביזר", belongsToDevice) }, { upsert: true })
                    );
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: a.cat }, { $addToSet: { belongsToDevices: { name, cat } } })
                    );
                });
            if (consumables && consumables.length > 0)
                consumables.forEach((c) => {
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: c.cat }, { $setOnInsert: preliminaryItem(c, sector, department, "מתכלה", belongsToDevice) }, { upsert: true })
                    );
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: c.cat }, { $addToSet: { belongsToDevices: { name, cat } } })
                    );
                });
            if (spareParts && spareParts.length > 0)
                spareParts.forEach((c) => {
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: c.cat }, { $setOnInsert: preliminaryItem(c, sector, department, "חלק חילוף", belongsToDevice) }, { upsert: true })
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
                            break;
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

    async editItems(req, res) {
        // PATCH path: /items
        const {
            cats, data: { sector, department, belongsToDevices, emergency, supplier }
        } = req.body;

        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            await Item.updateMany({ cat: { $in: cats}}, [
                { $set: { sector, department, emergency, supplier }},
                belongsToDevices?.length && { $addToSet: { belongsToDevices: belongsToDevices ?? [] }}
            ].filter(Boolean));
            await session.commitTransaction();
            session.endSession();
            return res.status(200).send('Items edited successfully!');            
        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            console.error(`Database update error: ${err}`);
            return res.status(400).send(`Failed to edit items`);
        }
    },

    async editItem(req, res) {
        // PUT path: /items/962780438
        const {
            name, cat, kitCats, sector, department, catType, certificationPeriodMonths, description, imageLink, qaStandardLink, medicalEngineeringManualLink, models, accessories, consumables, spareParts, belongsToDevices, similarItems, kitItem,
            hebrewManualLink, serviceManualLink, userManualLink, emergency, supplier, lifeSpan
        } = req.body;   

        try {

            const cmds = Object.keys({ 
                name, cat, kitCats, sector, department, catType, certificationPeriodMonths, description, imageLink, qaStandardLink, medicalEngineeringManualLink, models, accessories, consumables, spareParts, belongsToDevices, similarItems, kitItem,
                hebrewManualLink, serviceManualLink, userManualLink, emergency, lifeSpan
            }).reduce((obj, key) => ({ ...obj, $set: { ...obj.$set, [key]: req.body[key] }}), { $set: {} });
            if (supplier === undefined) {
                cmds.$unset = { supplier: "" };
            }
            else {
                cmds.$set.supplier = supplier;
            }

            const updateOwnItem = Item.findOneAndUpdate(
                { cat: req.params.cat },
                cmds,
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

            const belongsToDevice = { name, cat };
            const mongoInsertPromises = [updateOwnItem];
            
            if (accessories && accessories.length > 0)
                accessories.forEach((a) => {
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: a.cat }, { $setOnInsert: preliminaryItem(a, sector, department, "אביזר", belongsToDevice) }, { upsert: true })
                    );
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: a.cat }, { $addToSet: { belongsToDevices: { name: req.body.name, cat: req.body.cat } } })
                    );
                });
            if (consumables && consumables.length > 0)
                consumables.forEach((c) => {
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: c.cat }, { $setOnInsert: preliminaryItem(c, sector, department, "מתכלה", belongsToDevice) }, { upsert: true })
                    );
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: c.cat }, { $addToSet: { belongsToDevices: { name: req.body.name, cat: req.body.cat } } })
                    );
                });
            if (spareParts && spareParts.length > 0)
                spareParts.forEach((c) => {
                    mongoInsertPromises.push(
                        Item.updateOne({ cat: c.cat }, { $setOnInsert: preliminaryItem(c, sector, department, "חלק חילוף", belongsToDevice) }, { upsert: true })
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
                        case "חלק חילוף":
                            listType = "spareParts";
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

    async setArchivedItems (req, res) {
        // PUT path: /items/archive
        const {
            cats, archived
        } = req.body;

        if (archived === undefined || archived === null) {
            return res.status(400).send('Archived status must be provided.');
        }
        if (!cats || !Array.isArray(cats)) {
            return res.status(400).send('A list of catalog numbers must be provided.');
        }

        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            await Item.updateMany({ cat: { $in: cats}}, { $set: { archived }});
            await session.commitTransaction();
            session.endSession();
            return res.status(200).send('Items archive status set successfully!');            
        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            console.error(`Database update error: ${err}`);
            return res.status(400).send(`Failed to set archive status for items`);
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
            console.error(`Error creating upload url for item cat ${req.params.cat}: ${error}`);
            res.status(500).send(`A server error occurred while creating upload url for item cat ${req.params.cat}.`);
        }
    },



    async importItems(req, res) {
        // Check if a file was uploaded
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        const requiredFields = Object.keys(Item.schema.obj)
            .filter(key => Item.schema.obj[key].required)
            .map(key => worksheetColumns.find(col => col.key === key).header);

        const columnsToFields = worksheetColumns.reduce((obj, wc) => ({
            ...obj,
            [wc.header]: wc.key
        }), {});

        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(req.file.buffer);
            const worksheet = workbook.worksheets[0];

            // Validate columns
            const headerRow = worksheet.getRow(1);
            const columnNames = headerRow.values.slice(1); // skip first empty cell
            for (const field of requiredFields) {
                if (!columnNames.includes(field)) {
                    return res.status(400).send(`Missing required column: ${field}`);
                }
            }

            const suppliers = (await Supplier.find({}, { _id: 1, name: 1 })).reduce((obj, sup) => ({ ...obj, [sup.name]: sup._id }), {});
            const suppliersToAdd = [];
            const parentDevicesToRows = {};

            // Parse rows
            const itemsToInsert = [];
            const catToItems = {};
            const itemsToUpdate = [];
            const errors = [];
            worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                if (rowNumber === 1) return; // skip header

                const item = {};
                columnNames.forEach((col, idx) => {
                    if (columnsToFields[col]) {
                        item[columnsToFields[col]] = row.getCell(idx + 1).text;
                    }
                });

                // Validate required fields (except optional ones if any)
                for (const field of requiredFields) {
                    const fieldValue = item[columnsToFields[field]];
                    if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
                        errors.push(`שורה מספר ${rowNumber}: חסר ערך בשדה החובה "${field}"`);
                    }
                }

                // Parse fields that are arrays (kitCats, belongsToDevices, manufacturerCat, models)
                item.kitCats = item.kitCats ? String(item.kitCats).split(/\r?\n/).filter(Boolean) : undefined;
                if (item.belongsToDevices?.length && item.catType === 'מכשיר') {
                    errors.push(`שורה מספר ${rowNumber}: מכשיר אינו יכול להיות שייך לפריטים אחרים`);
                } else {
                    item.belongsToDevices = item.belongsToDevices ? String(item.belongsToDevices).split(/\r?\n/).filter(Boolean).map(cat => ({ cat })) : undefined;
                    item.belongsToDevices?.forEach(({ cat }) => parentDevicesToRows[cat] = [ ...(parentDevicesToRows[cat] ?? []), { rowNumber, item }]);
                }

                if (item.models || item.manufacturerCats) {
                    const manufacturers = String(item.manufacturer).split(/\r?\n/);
                    const manufacturerCats = String(item.manufacturerCat).split(/\r?\n/);
                    const modelNames = String(item.models).split(/\r?\n/);           
                    item.models = Array.from(Array(Math.max(modelNames.length ?? 0, manufacturerCats.length ?? 0, manufacturers. length ?? 0)), 
                    (_, i) => ({ manufacturer: manufacturers[i], cat: manufacturerCats[i], name: modelNames[i] }));
                } else {
                    item.models = undefined;
                }
                item.manufacturerCats = undefined;
                if ([ item.supplier, item.supplierId ].filter(supplierField => (supplierField?.length ?? 0) > 0).length === 1) {
                    errors.push(`שורה מספר ${rowNumber}: ספק ומספר ספק במשרד הביטחון חייבים שניהם להופיע בשורה או לא להופיע כלל`);
                } else if (item.supplier?.length) {
                    if (suppliers[item.supplier]) {
                        item.supplier = suppliers[item.supplier];
                    } else {
                        console.log(`new supplier: ${item.supplier}`);
                        const newId = ObjectId();
                        suppliersToAdd.push({ _id: newId, id: item.supplierId, name: item.supplier});
                        item.supplier = newId;
                    }
                } else {
                    item.supplier = undefined;
                }
                item.supplierId = undefined;

                // Parse booleans
                item.archived = item.archived === 'כן';
                item.emergency = item.emergency === 'כן';

                console.log(`adding imported item: ${JSON.stringify(item)}`);
                itemsToInsert.push(item);
                if (catToItems[item.cat]) {
                    errors.push(`שורה מספר ${rowNumber}: פריט מספר ${item.cat} כבר הופיע בקובץ`);
                } else {
                    catToItems[item.cat] = { item, rowNumber };
                }
            });

            const existingItems = await Item.find({ cat: { $in: Object.keys(catToItems) }}, { cat: 1 });
            errors.push(...existingItems.map(({ cat }) => `שורה מספר ${catToItems[cat].rowNumber}: מק"ט ${cat} כבר קיים במערכת`));

            console.log(`parentDevicesToRows: ${JSON.stringify(parentDevicesToRows)}`);
            if (Object.keys(parentDevicesToRows).length) {
                for (const itemToInsert of itemsToInsert) {
                    if (parentDevicesToRows[itemToInsert.cat]) {
                        if (itemToInsert.catType !== 'מכשיר') {
                            errors.push(...parentDevicesToRows[itemToInsert.cat].map(({ rowNumber }) => `שורה מספר ${rowNumber}: פריט אינו יכול להיות שייך למכשיר שסוג המק"ט שלו הוא ${itemToInsert.catType}`));
                        } else {
                            parentDevicesToRows[itemToInsert.cat].forEach(({ item }) => {
                                const childrenField = catTypeToChildrenArrayField(item.catType);
                                if (!itemToInsert[childrenField]) {
                                    itemToInsert[childrenField] = [item]
                                } else {
                                    itemToInsert[childrenField].push(item);
                                }
                            });
                        }
                        console.log(`deleting cat ${itemToInsert.cat} - part of excel`);
                        delete parentDevicesToRows[itemToInsert.cat];
                    }
                }
                if (Object.keys(parentDevicesToRows).length) {
                    const dbParents = await Item.find({ cat: { $in: Object.keys(parentDevicesToRows) }}, { cat: 1, catType: 1 });
                    for (const dbParent of dbParents) {
                        if (parentDevicesToRows[dbParent.cat]) {
                            if (dbParent.catType !== 'מכשיר') {
                                errors.push(`שורה מספר ${parentDevicesToRows[dbParent.cat].rowNumber}: פריט אינו יכול להיות שייך למכשיר שסוג המק"ט שלו הוא ${dpParent.catType}`);
                            } else {
                                console.log(`deleting cat ${dbParent.cat} - part of db`);
                                const children = parentDevicesToRows[dbParent.cat].map(parent => parent.item);
                                itemsToUpdate.push(...children.map(child => {
                                    const listType = catTypeToChildrenArrayField(child.catType);
                                    return { updateOne: { filter: { cat: dbParent.cat }, update: { $addToSet: { [listType]: { cat: child.cat } }}}};
                                }));
                            }

                            delete parentDevicesToRows[dbParent.cat];
                        }
                    }
                    if (Object.keys(parentDevicesToRows).length) {
                        console.log(`adding parent errors!`);
                        const errorMessages = Object.keys(parentDevicesToRows)
                            .flatMap(cat => parentDevicesToRows[cat]
                                .map(({ rowNumber }) => `שורה מספר ${rowNumber}: הפריט שייך לפריט אינו ידוע בעל מק"ט ${cat}`));
                        errors.push(errorMessages);
                        console.log(`current errors: ${JSON.stringify(errors)}`);
                    }
                }
            }

            if (errors.length) {
                console.error(`errors importing items: ${JSON.stringify(errors)}`);
                return res.status(400).json({ error: 'Validation failed', details: errors });
            }

            // Insert all items in a transaction
            const session = await mongoose.startSession();
            session.startTransaction();
            try {
                console.log(`added suppliers: ${JSON.stringify(suppliersToAdd)}`);
                if (suppliersToAdd.length) {
                    await Supplier.insertMany(suppliersToAdd, { session });
                }
                console.log(`bulk write operations: ${JSON.stringify([
                    ...itemsToInsert.map(item => ({ insertOne: { document: item } })),
                    ...itemsToUpdate,
                ])}`);
                await Item.bulkWrite([
                    ...itemsToInsert.map(item => ({ insertOne: { document: item } })),
                    ...itemsToUpdate,
                ], { session });
                //await Item.insertMany(itemsToInsert, { session });
                await session.commitTransaction();
                session.endSession();
                return res.status(200).send('Items imported successfully!');
            } catch (err) {
                await session.abortTransaction();
                session.endSession();
                console.error(`Database insert error: ${err}`);
                return res.status(400).send(`Failed to process Excel file`);
            }
        } catch (error) {
            console.error(`Excel import erorr: ${error}`);
            return res.status(400).send(`Failed to process Excel file`);
        }
    },
    
    async getItemsWorksheet(req, res) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Items');

        console.log(`Generating Excel worksheet for items...`);

        worksheet.columns = worksheetColumns;

        let items;
        let offset = 0;
        const batchSize = 500;
        do {
            items = await Item.find({}, { 
                    name: 1, cat: 1, kitCats: 1, sector: 1, department: 1, models: 1, archived: 1, catType: 1, certificationPeriodMonths: 1, description: 1, imageLink: 1, qaStandardLink: 1, medicalEngineeringManualLink: 1, 
                    serviceManualLink: 1, userManualLink: 1, hebrewManualLink: 1, emergency: 1, supplier: 1, lifeSpan: 1, belongsToDevices: 1, kitItem: 1 
                })
                .sort('cat')
                .skip(offset)
                .limit(batchSize)
                .populate('supplier', 'name');
            if (items?.length) {
                worksheet.addRows(items.map(({ 
                    name, cat, kitCats, sector, department, models, catType, certificationPeriodMonths, description, imageLink, qaStandardLink, medicalEngineeringManualLink, serviceManualLink, userManualLink,
                    hebrewManualLink, archived, belongsToDevices, emergency, supplier, lifeSpan,
                }) => (
                    { 
                        name, cat, sector, department, models, catType, certificationPeriodMonths, description, imageLink, qaStandardLink, medicalEngineeringManualLink, serviceManualLink, userManualLink, 
                        hebrewManualLink, lifeSpan,
                        supplier: supplier?.name ?? '',
                        supplierId: supplier?.id ?? '',
                        emergency: emergency ? 'כן' : 'לא',
                        kitCats: kitCats?.join('\r\n'),
                        archived: archived ? 'כן' : 'לא',
                        belongsToDevices: belongsToDevices?.map(b => b.cat).join('\r\n'),
                        manufacturer: models?.map(m => m.manufacturer).join('\r\n'),
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
