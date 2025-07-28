const Technician = require("../models/Technician");
const { decodeItems } = require("../functions/helpers");

module.exports = {
    async getTechnicians(req, res) {
        // GET path: /technicians?search=jjo&page=0
        const { search, page = 0 } = req.query;
        const [decodedSearch] = decodeItems(search);
        // privilege stored in req.userPrivilege ("public"/"hanar"/"admin")
        try {

            const technicians = await Technician
                .find(search
                    ? {
                            $or: [
                                { id: { $regex: decodedSearch, $options: "i" } },
                                { firstName: { $regex: decodedSearch, $options: "i" } },
                                { lastName: { $regex: decodedSearch, $options: "i" } },
                                { association: { $regex: decodedSearch, $options: "i" } },
                            ],
                        }
                    : {},
                    { id: 1, firstName: 1, lastName: 1, association: 1, _id: 1 },
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
                { _id: 1, id: 1, firstName: 1, lastName: 1, association: 1 });

            if (technician) {
                res.status(200).send(technician);
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
            id, firstName, lastName, association,
        } = req.body;

        const newTechnician = new Technician({
            id, firstName, lastName, association
        });

        try {  
            const idAlreadyExists = await Technician.findOne({ id: id });
            if (idAlreadyExists) return res.status(400).send({ errorMsg: "This id number is already in the database." });

            await newTechnician.save();
            res.status(200).send("Technician saved successfully!");
        } catch (error) {
            res.status(400).send("Failure saving technician: ", error);
        }
    },

    async editTechnician(req, res) {
        // PUT path: /technicians/962780438
        const { id, firstName, lastName, association } = req.body;

        try {
            await Technician.findByIdAndUpdate(req.params.id, { id, firstName, lastName, association });
            res.status(200).send("Technician updated successfully!");
        } catch (error) {
            res.status(400).send("Failure updating technician: ", error);
        }
    },
    
    async deleteTechnician(req, res) {
        // DELETE path: /technicians/962780438
        try {
            await Technician.findByIdAndRemove(req.params.id);
            res.status(200).send("Technician removed successfully!");
        } catch (error) {}
    },

     toggleArchive: async (req, res) => {
        try {
            const technician = await Technician.findById(req.params.id)

            if (!technician) {
                return res.status(404).send('Technician not found.');
            }

            technician.archived = !technician.archived;
            await technician.save();

            res.status(200).json(item);

        } catch (error) {
            console.error(`Error toggling archive for item ${req.params.cat}:`, error);
            res.status(500).send('A server error occurred.');
        }
    }, 
};
