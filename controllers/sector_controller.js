const Sector = require("../models/Sector");
const { disallowedSectors } = require("../rules/privileges");

module.exports = {
    async getFullSectors(req, res) {
        try {
            const sectors = await Sector.find({ sectorName: { $nin: disallowedSectors[req.userPrivilege] } });
            res.status(200).send(sectors);
        } catch (error) {
            res.status(400).send(`Error fetching sectors: ${error}`);
        }
    },

    // Admin-only access:
    async addSector(req, res) {
        // POST route: /sectors
        if (req.body.sectorName.length === 0) return res.status(400).send("Please enter a valid sector name");

        try {
            const sectorAlreadyExists = await Sector.find({ sectorName: req.body.sectorName });
            if (sectorAlreadyExists.length > 0) return res.status(400).send("Sector already exists!");

            const newSector = new Sector({
                sectorName: req.body.sectorName,
                departments: req.body.departments,
            });
            await newSector.save();
            res.status(200).send("Sector added successfully!");
        } catch (error) {
            res.status(400).send(`Error adding sector: ${error}`);
        }
    },
    async editSectorName(req, res) {
        // PUT route: /sectors/שגרה
        const hebrewSectorName = decodeURI(req.params.sectorname);

        if (req.body.sectorName.length === 0) return res.status(400).send("Please enter a valid sector name");

        try {
            await Sector.findOneAndUpdate({ sectorName: hebrewSectorName }, { sectorName: req.body.sectorName });
            res.status(200).send(`Sector name successfully updated to ${req.body.sectorName}`);
        } catch (error) {
            res.status(400).send(`Error editing sector name of ${hebrewSectorName} to ${req.body.sectorName}: ${error}`);
        }
    },
    async deleteSector(req, res) {
        // DELETE route: /sectors
        try {
            await Sector.findOneAndRemove({ sectorName: req.body.sectorName });
            res.status(200).send(`Sector ${req.body.sectorName} deleted successfully!`);
        } catch (error) {
            res.status(400).send(`Error deleting sector ${req.body.sectorName}: ${error}`);
        }
    },
    async addDepartmentToSector(req, res) {
        // POST route: /sectors/שגרה
        const hebrewSectorName = decodeURI(req.params.sectorname);

        try {
            const sectorToLookIn = await Sector.findOne({
                sectorName: hebrewSectorName,
            });
            if (!sectorToLookIn) return res.status(400).send("Sector does not exist");

            if (sectorToLookIn.departments.includes(req.body.departmentName))
                return res.status(400).send("This department already exists in chosen sector!");

            const newDepartment = { departmentName: req.body.departmentName };
            sectorToLookIn.departments.push(newDepartment);
            await sectorToLookIn.save();

            res.status(200).send(`Success saving new department in sector!`);
        } catch (error) {
            res.status(400).send(`Error adding department to sector: ${error}`);
        }
    },
    async deleteDepartmentFromSector(req, res) {
        // DELETE route: /sectors/שגרה
        const hebrewSectorName = decodeURI(req.params.sectorname);

        try {
            await Sector.findOneAndUpdate({ sectorName: hebrewSectorName }, { $pull: { departments: req.body.departmentName } });

            res.status(200).send(`Success deleting department from sector!`);
        } catch (error) {
            res.status(400).send(`Error deleting department from sector: ${error}`);
        }
    },
};
