const Certification = require("../models/Certification");
const { decodeItems } = require("../functions/helpers");
const ExcelJS = require('exceljs'); 
const Role = require("../models/Role");

const defaultProjection = {
     itemId: 1, itemCat: 1, itemName: 1, userId: 1, userFirstName: 1, userLastName: 1, certificationDocumentLink: 1,
     firstCertificationDate: 1, lastCertificationDate: 1, lastCertificationDurationMonths: 1, plannedCertificationDate: 1
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

            await newCertification.save();
            res.status(200).send("Certification saved successfully!");
        } catch (error) {
            res.status(400).send(`Failure saving certification: ${error}`);
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
            });
            res.status(200).send("Certification updated successfully!");
        } catch (error) {
            res.status(400).send(`Failure updating certification: ${error}`);
        }
    },
    
    async deleteCertification(req, res) {
        // DELETE path: /certification/962780438
        try {
            await Certification.findByIdAndRemove(req.params.id);
            res.status(200).send("Certification removed successfully!");
        } catch (error) {}
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
