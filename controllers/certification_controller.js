const Certification = require("../models/Certification");
const { decodeItems } = require("../functions/helpers");

const defaultProjection = {
     itemId: 1, itemCat: 1, itemName: 1, technicianId: 1, technicianFirstName: 1, technicianLastName: 1, certificationDocumentLink: 1,
     firstCertificationDate: 1, lastCertificationDate: 1, lastCertificationDurationMonths: 1, plannedCertificationDate: 1 
}

module.exports = {
    async getCertifications(req, res) {
        // GET path: /certification?search=jjo&page=0
        const { search, page = 0 } = req.query;
        const [decodedSearch] = decodeItems(search);
        // privilege stored in req.userPrivilege ("public"/"hanar"/"admin")
        try {

            const certifications = await Certification
                .find({ $and: [
                    { archived: {$ne: true} },
                    search
                    ? {
                            $or: [
                                { itemCat: { $regex: decodedSearch, $options: "i" } },
                                { itemName: { $regex: decodedSearch, $options: "i" } },
                                { technicianfirstName: { $regex: decodedSearch, $options: "i" } },
                                { technicianLastName: { $regex: decodedSearch, $options: "i" } },
                            ],
                        }
                    : {}
                    ] },
                    defaultProjection,
                )
                .populate('item')
                .populate('technician')
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
                .populate('technician')

            if (certification) {
                res.status(200).send(certification);
            } else {
                res.status(404).send("Certification could not be found in database");
            }
        } catch (error) {
            res.status(400).send("Certification fetch error: ", error);
        }
    },

    // admin-only controllers:
    async addCertification(req, res) {
        // POST path: /certifications
        const {
            item, technician, certificationDocumentLink,
            firstCertificationDate, lastCertificationDate, lastCertificationDurationMonths, plannedCertificationDate
        } = req.body;

        const newCertification = new Certification({
            item, technician, certificationDocumentLink,
            firstCertificationDate, lastCertificationDate, lastCertificationDurationMonths, plannedCertificationDate
        });

        try {
            const certificationAlreadyExists = await Certification.findOne({ item, technician });
            if (certificationAlreadyExists) return res.status(400).send({ errorMsg: "A certification for thie cat and technician id number is already in the database." });

            await newCertification.save();
            res.status(200).send("Certification saved successfully!");
        } catch (error) {
            res.status(400).send("Failure saving certification: ", error);
        }
    },

    async editCertification(req, res) {
        // PUT path: /certification/962780438
        const {
            item, technician, certificationDocumentLink,
            firstCertificationDate, lastCertificationDate, lastCertificationDurationMonths, plannedCertificationDate
        } = req.body;

        try {
            await Certification.findByIdAndUpdate(req.params.id, { 
                item, technician, certificationDocumentLink,
                firstCertificationDate, lastCertificationDate, lastCertificationDurationMonths, plannedCertificationDate
            });
            res.status(200).send("Certification updated successfully!");
        } catch (error) {
            res.status(400).send("Failure updating certification: ", error);
        }
    },
    
    async deleteCertification(req, res) {
        // DELETE path: /certification/962780438
        try {
            await Certification.findByIdAndRemove(req.params.id);
            res.status(200).send("Certification removed successfully!");
        } catch (error) {}
    },
};
