const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { decodeItems } = require("../functions/helpers");
const { ManagementClient } = require('auth0');
var generator = require('generate-password');


const AUTO_LOGOUT_TIME = 8; // in hours

module.exports = {
    async getUsers(req, res) {
        // GET path: /users?search=jjo&page=0
        const { search, page = 0 } = req.query;
        const [decodedSearch] = decodeItems(search);
        // privilege stored in req.userPrivilege ("public"/"hanar"/"admin")
        console.log(`search: ${search ? "yes" : "no"}`);
        try {

            const query = search
                    ? {
                        $or: [
                            { firstName: { $regex: decodedSearch, $options: "i" } },
                            { lastName: { $regex: decodedSearch, $options: "i" } },
                            { username: { $regex: decodedSearch, $options: "i" } },
                            { email: { $regex: decodedSearch, $options: "i" } },
                        ]
                    } : {};
            console.log(`query: ${JSON.stringify(query)}`);

            const users = await User
                .find(search
                    ? {
                        $or: [
                            { firstName: { $regex: decodedSearch, $options: "i" } },
                            { lastName: { $regex: decodedSearch, $options: "i" } },
                            { username: { $regex: decodedSearch, $options: "i" } },
                            { email: { $regex: decodedSearch, $options: "i" } },
                        ]
                    } : {},
                    { id: 1, firstName: 1, lastName: 1, username: 1, role: 1, _id: 1 },
                )
                .sort("firstName")
                .skip(page * 20)
                .limit(20);
            console.log(`Users found: ${users.length}, list: ${JSON.stringify(users)}`);
            res.status(200).send(users);
        } catch (error) {
            res.status(400).send(`Error fetching users: ${error}`);
        }
    },

    async getUserInfo(req, res) {
        try {
            const user = await User.findById(req.params.id,
                { _id: 1, id: 1, firstName: 1, lastName: 1, username: 1, email: 1, role: 1, association: 1 });

            if (user) {
                res.status(200).send(user);
            } else {
                res.status(404).send("User could not be found in database");
            }
        } catch (error) {
            res.status(400).send("User fetch error: ", error);
        }
    },    

    // public routes:
    async addUser(req, res) {
        // check if username already registered:
        const userExistsInDB = await User.findOne({
            $or: [
                { id: req.body.id },
                { username: req.body.username },
                { email: req.body.email }
            ]
        });
        if (userExistsInDB) return res.status(400).send("User already registered!");

        var management = new ManagementClient({
            domain: process.env.AUTH0_DOMAIN,
            clientId: process.env.AUTH0_CLIENT_ID,
            clientSecret: process.env.AUTH0_CLIENT_SECRET
        });

        var password = generator.generate({
            length: 10,
            numbers: true,
            symbols: true,
        });

        const createUserRes = await management.users.create({ 
            username: req.body.username,
            email: req.body.email,
            given_name: req.body.firstName,
            family_name: req.body.lastName,
            password,
            connection: 'Username-Password-Authentication'
        });

        const roleId = (await management.roles.getAll({ name_filter: req.body.role })).data?.[0].id;
        if (!roleId) {
            res.status(400).send(`Cannot create user with unknown role: ${request.body.role}`);
            return;
        }

        const assignRoleRes = await management.roles.assignUsers({
            id: roleId,
        }, { users: [ createUserRes.data.user_id ] });

        const user = new User({
            id: req.body.id,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            username: req.body.username,
            email: req.body.email,
            role: req.body.role ?? "technician",
            association: req.body.association,
        });

        try {
            await user.save();
            res.status(200).send("User created!");
        } catch (error) {
            console.log(`error creating user in DB: ${error}`);
            await management.users.delete({ id: createUserRes.data.user_id });
            res.status(400).send(error);
        }
    },
    async authenticateUser(req, res) {
        try {
            // check if email registered:
            //console.log("333333");
            const user = await User.findOne({ username: req.body.username });
            //console.log("AAAA");
            if (!user) return res.status(400).send("username or password wrong!");

            // check password:
            const validPassword = await bcrypt.compare(req.body.password, user.password);
            //console.log("BBBB");
            if (!validPassword) return res.status(400).send("username or password wrong!");

            // create JWT and send it:
            const jwtExpiryDate = new Date().getTime() + AUTO_LOGOUT_TIME * 60 * 60 * 1000;
            const token = jwt.sign({ _id: user._id, privilege: user.privilege }, process.env.JWT_TOKEN_SECRET, { expiresIn: `${AUTO_LOGOUT_TIME}h` });

            res.status(200).send({ authToken: token, frontEndPrivilege: user.privilege, jwtExpiryDate: jwtExpiryDate });
            // MAKE SURE TO CATCH the auth-token HEADER AND SAVE IN LOCAL STORAGE
        } catch (error) {
            res.status(400).send("MongoDB error - Unable to find user even though password is correct: ", error);
        }
    },

    // user-only routes:

    // NO NEED FOR LOGOUT ROUTE SINCE WE ONLY CLEAR THE HEADERS FROM LOCAL STORAGE

    async changePassword(req, res) {
        try {
            const salty = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(req.body.password, salty);

            await User.findOneAndUpdate({ _id: req.userId }, { password: hashedPassword });

            res.status(200).send("Successfully changed password! Please log in again.");
        } catch (error) {
            res.status(400).send("Error changing password: ", error);
        }
    },
};
