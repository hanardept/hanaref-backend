const Certification = require("../models/Certification");
const { decodeItems } = require("../functions/helpers");
const ExcelJS = require('exceljs'); 
const Role = require("../models/Role");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner")
const { S3Client, PutObjectCommand, DeleteObjectsCommand, ListObjectVersionsCommand } = require("@aws-sdk/client-s3");

const defaultProjection = {
     itemId: 1, itemCat: 1, itemName: 1, userId: 1, userFirstName: 1, userLastName: 1, certificationDocumentLink: 1,
     firstCertificationDate: 1, lastCertificationDate: 1, lastCertificationDurationMonths: 1, plannedCertificationDate: 1
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
    async getCertifications(req, res) {
        // GET path: /certification?search=jjo&page=0
        let { search, user, page = 0 } = req.query;
        console.log(`user privilege: ${req.userPrivilege}`);
        if (req.userPrivilege !== Role.Admin) {
            console.log(`setting user id to: ${req.userId}`);
            user = req.userId;
        }
        const [decodedSearch, decodedUser ] = decodeItems(search, user);
        // privilege stored in req.userPrivilege ("public"/"hanar"/"admin")

        console.log(`Fetching certifications with search: ${decodedSearch}, user: ${decodedUser}, page: ${page}`);
        try {

            const certifications = await Certification
                .find({ $and: [
                    { archived: {$ne: true} },
                    user ? { user: decodedUser } : {},
                    search
                    ? {
                            $or: [
                                { itemCat: { $regex: decodedSearch, $options: "i" } },
                                { itemName: { $regex: decodedSearch, $options: "i" } },
                                { userFirstName: { $regex: decodedSearch, $options: "i" } },
                                { userLastName: { $regex: decodedSearch, $options: "i" } },
                            ],
                        }
                    : {}
                    ] },
                    defaultProjection,
                )
                .populate('item')
                .populate('user')
                .sort("itemCat")
                .skip(page * 20)
                .limit(20);
            
            res.status(200).send(certifications);
        } catch (error) {
            res.status(400).send(`Error fetching certifications: ${error}`);
        }
    },

    async getCertificationInfo(req, res) {
        try {

            const certification = await Certification
                .findById(req.params.id, defaultProjection)
                .populate('item')
                .populate('user')

            if (certification) {
                res.status(200).send(certification);
            } else {
                res.status(404).send("Certification could not be found in database");
            }
        } catch (error) {
            res.status(400).send(`Certification fetch error: ${error}`);
        }
    },

    // admin-only controllers:
    async addCertification(req, res) {
        // POST path: /certifications
        const {
            item, user, certificationDocumentLink,
            firstCertificationDate, lastCertificationDate, lastCertificationDurationMonths, plannedCertificationDate
        } = req.body;

        const newCertification = new Certification({
            item, user, certificationDocumentLink,
            firstCertificationDate, lastCertificationDate, lastCertificationDurationMonths, plannedCertificationDate
        });

        try {
            const certificationAlreadyExists = await Certification.findOne({ item, user });
            if (certificationAlreadyExists) return res.status(400).send({ errorMsg: "A certification for thie cat and user id number is already in the database." });

            const saveRes = await newCertification.save();
            console.log(`save res: ${JSON.stringify(saveRes)}`);
            res.status(200).send(JSON.stringify({ id: saveRes._id }));
        } catch (error) {
            console.error(`Failure saving certification: ${error}`);
            res.status(400).send(`Failure saving certification.`);
        }
    },

    async editCertification(req, res) {
        // PUT path: /certification/962780438
        const {
            item, user, certificationDocumentLink,
            firstCertificationDate, lastCertificationDate, lastCertificationDurationMonths, plannedCertificationDate
        } = req.body;

        try {
            await Certification.findByIdAndUpdate(req.params.id, { 
                item, user, certificationDocumentLink,
                firstCertificationDate, lastCertificationDate, lastCertificationDurationMonths, plannedCertificationDate
            }, { returnOriginal: true }).then(original => {
                const linkFields = [ 'certificationDocumentLink' ];
                const s3ObjectsToDelete = linkFields
                    .filter(link => original[link]?.length && (req.body[link] !== original[link]) && !linkFields.some(field => original[link] === req.body[field] ))
                    .map(link => prepareS3KeyFromLink(original[link]));
                console.log(`s3 objects to delete: ${s3ObjectsToDelete}`);
                if (s3ObjectsToDelete.length) {
                    deleteS3Objects(s3ObjectsToDelete);
                }
            });
            res.status(200).send("Certification updated successfully!");
        } catch (error) {
            console.error(`Failure updating certification: ${error}`);
            res.status(400).send(`Failure updating certification`);
        }
    },
    
    async deleteCertification(req, res) {
        // DELETE path: /certification/962780438
        try {
            const removed = await Certification.findById(req.params.id);

            try {
                const objects = [ removed.certificationDocumentLink ]
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
                console.log(`Error deleting s3 objects for certification id ${req.params.id}: ${error}`);
                throw error;
            }

            await Certification.findOneAndRemove({ cat: req.params.id });            

            res.status(200).send("Certification removed successfully!");
        } catch (error) {
            console.error(`Error removing certification id ${req.params.id}: ${error}`);
            res.status(400).send(`Failure removing certification`);
        }
    },

    async createFileUploadUrl(req, res) {
        try {
            const certification = await Certification
                .findById(req.params.id, { _id: 1, item: 1, user: 1 })
                .populate('item', 'cat name')
                .populate('user', '_id firstName lastName');
            if (!certification) {
                return res.status(404).send('Certification not found.');
            }
            console.log(`certification: ${JSON.stringify(certification)}`);
            const client = new S3Client({ apiVersion: '2006-03-01' });
            const { item, user } = certification;
            const params = {
                Bucket: process.env.BUCKET_NAME,
                Key: `Certifications/${item.cat} - ${item.name}/${user._id} - ${user.firstName} ${user.lastName}/${req.body.filename}`,
                ContentType: req.body.contentType,
            };
            const command = new PutObjectCommand(params);
            const url = await getSignedUrl(client, command, { expiresIn: 3600 });
            res.status(200).json({ url });
        } catch (error) {
            console.error(`Error creating upload url for certification id ${req.params.id}: ${error}`);
            res.status(500).send(`A server error occurred while creating upload url for certification id ${req.param.id}.`);
        }
    },    

    async getCertificationsWorksheet(req, res) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Certifications');

        console.log(`Generating Excel worksheet for certifications...`);

        worksheet.columns = [{
            header: 'מק"ט',
            key: 'item',
            width: 20
        }, {
            header: 'ת.ז. טכנאי',
            key: 'userId',
            width: 15
        }, {
            header: 'שם פרטי טכנאי',
            key: 'userFirstName',
            width: 15
        }, {
            header: 'שם משפחה טכנאי',
            key: 'userLastName',
            width: 20
        }, {
            header: 'תאריך הסמכה ראשונה',
            key: 'firstCertificationDate',
            width: 20
        }, {
            header: 'תאריך הסמכה אחרונה',
            key: 'lastCertificationDate',
            width: 20
        }, {
            header: 'תוקף הסמכה בחודשים',
            key: 'lastCertificationDurationMonths',
            width: 10,
        }, {
            header: 'תאריך הסמכה צפויה',
            key: 'plannedCertificationDate',
            width: 20,
        }, {
            header: 'קישור לתעודת הסמכה',
            key: 'certificationDocumentLink',
            width: 40
        }, {
            header: 'בארכיון',
            key: 'archived',
            width: 10
        }];

        let certifications;
        let offset = 0;
        const batchSize = 500;
        do {
            certifications = await Certification.find({}, { firstCertificationDate: 1, lastCertificationDate: 1, lastCertificationDurationMonths: 1, plannedCertificationDate: 1, certificationDocumentLink: 1, archived: 1 })
                .populate('item')
                .populate('user')
                .sort('item.cat')
                .skip(offset)
                .limit(batchSize);
            if (certifications?.length) {
                worksheet.addRows(certifications.map(({ item, user, firstCertificationDate, lastCertificationDate, lastCertificationDurationMonths, plannedCertificationDate, certificationDocumentLink, archived }) => (
                    { 
                        item: item.cat,
                        userId: user.id,
                        userFirstName: user.firstName,
                        userLastName: user.lastName,
                        firstCertificationDate, lastCertificationDate, lastCertificationDurationMonths, plannedCertificationDate, certificationDocumentLink,
                        archived: archived ? 'כן' : 'לא',
                    }
                )));
            }
            offset += batchSize;
        } while (certifications.length > 0);

        // Set the response headers
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=' + 'certifications.xlsx'
        );

        try {
            await workbook.xlsx.write(res);
            res.end();
        } catch (error) {
            console.error(`Error sending Excel file: ${error}`);
            res.status(500).send('Error sending Excel file');
        }
    }    
};
