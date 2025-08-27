const User = require("../models/User");
const { decodeItems } = require("../functions/helpers");
const Certification = require("../models/Certification");

module.exports = {
    async getTechnicians(req, res) {
        // GET path: /technicians?search=jjo&page=0
        const { search, page = 0, status } = req.query;
        const [decodedSearch] = decodeItems(search);
        // privilege stored in req.userPrivilege ("public"/"hanar"/"admin")
        console.log(`status: ${status}, search: ${search ? "yes" : "no"}`);
        try {
            const users = await User
                .find({ $and: [
                    (status !== 'all') ? { archived: {$ne: true} } : {},
                    search
                    ? {
                        $or: [
                            { firstName: { $regex: decodedSearch, $options: "i" } },
                            { lastName: { $regex: decodedSearch, $options: "i" } },
                            { association: { $regex: decodedSearch, $options: "i" } },
                        ]
                    } : {}
                    ] },
                    { firstName: 1, lastName: 1, association: 1, archived: 1, _id: 1 },
                )
                .sort("firstName")
                .skip(page * 20)
                .limit(20);
            console.log(`Users found: ${users.length}`);
            res.status(200).send(users);
        } catch (error) {
            res.status(400).send(`Error fetching users: ${error}`);
        }
    },

    async getTechnicianInfo(req, res) {
        try {

            const user = await User.findById(req.params.id,
                { _id: 1, firstName: 1, lastName: 1, association: 1, archived: 1 });

            if (user) {
                res.status(200).send(user);
            } else {
                res.status(404).send("User could not be found in database");
            }
        } catch (error) {
            res.status(400).send("User fetch error: ", error);
        }
    },

    // admin-only controllers:
    async addTechnician(req, res) {
        // POST path: /technicians
        const {
            firstName, lastName, association
        } = req.body;

        const newUser = new User({
            firstName, lastName, association
        });

        try {  
            await newUsersave();
            res.status(200).send("User saved successfully!");
        } catch (error) {
            res.status(400).send("Failure saving user: ", error);
        }
    },

    async editTechnician(req, res) {
        // PUT path: /technicians/962780438
        const { firstName, lastName, association } = req.body;

        try {
            await User.findByIdAndUpdate(req.params.id, { firstName, lastName, association });
            res.status(200).send("User updated successfully!");
        } catch (error) {
            res.status(400).send("Failure updating user: ", error);
        }
    },
    
    async deleteTechnician(req, res) {
        // DELETE path: /technicians/962780438
        try {
            await Promise.all([
                User.findByIdAndRemove(req.params.id),
                Certification.deleteMany({ user: req.params.id })
            ]);
            res.status(200).send("User removed successfully!");
        } catch (error) {}
    },

     toggleArchive: async (req, res) => {
        try {
            const user = await User.findById(req.params.id)

            if (!user) {
                return res.status(404).send('User not found.');
            }

            const newArchiveStatus = !user.archived;
            user.archived = newArchiveStatus;
            await Promise.all([
                user.save(),
                Certification.updateMany({ user: user._id }, { $set: { archived: newArchiveStatus } })
            ]);

            res.status(200).json(user);

        } catch (error) {
            console.error(`Error toggling archive for user ${req.params.id}:`, error);
            res.status(500).send('A server error occurred.');
        }
    }, 
};
