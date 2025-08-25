const User = require("../models/User");
const Role = require("../models/Role");
const Certification = require("../models/Certification");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { decodeItems } = require("../functions/helpers");
const { ManagementClient } = require('auth0');
var generator = require('generate-password');


const AUTO_LOGOUT_TIME = 8; // in hours

const createManagementClient = () => {
    return new ManagementClient({
        domain: process.env.AUTH0_DOMAIN,
        clientId: process.env.AUTH0_CLIENT_ID,
        clientSecret: process.env.AUTH0_CLIENT_SECRET
    });
};

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
    
    async registerUser(req, res) {
        console.log(`registering user with body: ${JSON.stringify(req.body)}, headers: ${JSON.stringify(req.headers)}`);
        const userExistsInDB = await User.findOne({
            $or: [
                { username: req.body.username },
                { email: req.body.email },
            ]
        });
        if (userExistsInDB) return res.status(400).send("User already registered!");

        const management = createManagementClient();
        const userManagementUser = (await management.users.getAll({ q: `username:"${user.username}"`, fields: [ 'user_id' ], include_fields: true })).data?.[0];;

        const user = new User({
            id: '',
            firstName: '',
            lastName: '',
            username: req.body.username,
            email: req.body.email,
            role: Role.Viewer,
            status: 'registered',
        });

        try {
            await Promise.all([
                user.save(),
                management.users.update({ id: userManagementUser.user_id }, { user_metadata: { user_id: user._id } })
            ]);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(JSON.stringify({ userId: user._id }));
        } catch (error) {
            console.log(`error creating user in DB: ${error}`);
            res.status(400).send(error);
        }       
    },

    // public routes:
    async addUser(req, res) {
        console.log(`adding user with body: ${JSON.stringify(req.body)}`);
        // check if username already registered:
        const userExistsInDB = await User.findOne({
            $or: [
                { id: req.body.id },
                { username: req.body.username },
                { email: req.body.email }
            ]
        });
        if (userExistsInDB) return res.status(400).send("User already registered!");

        const user = new User({
            id: req.body.id,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            username: req.body.username,
            email: req.body.email,
            role: req.body.role ?? Role.Viewer,
            association: req.body.association,
            status: 'active',
        });

        try {
            await user.save();
            res.status(200).send("User created!");
        } catch (error) {
            console.log(`error creating user in DB: ${error}`);
            res.status(400).send(error);
        }        

        try {
            const management = createManagementClient();

            const password = generator.generate({
                length: 10,
                numbers: true,
                symbols: true,
            });

            const createUserRes = await management.users.create({ 
                user_id: user._id,
                username: req.body.username,
                email: req.body.email,
                given_name: req.body.firstName,
                family_name: req.body.lastName,
                password,
                connection: 'Username-Password-Authentication',
                user_metadata: {
                    user_id,
                    role: req.body.role,
                    status: 'active',
                    api: true,
                },
                email_verified: true,
            });
        } catch (error) {
            console.log(`error creating user in Auth0: ${error}`);
            await User.findByIdAndDelete (user._id);
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

    async confirmUser(req, res) {
        console.log(`confirming user with id: ${req.params.id}`);

        let updateError;

        try {
            const user = await User.findById(req.params.id);

            if (!user) {
                return res.status(404).send('User not found.');
            }

            const prevStatus = user.status;
            user.status = 'active';

            const management = createManagementClient();

            const userManagementUser = (await management.users.getAll({ q: `user_metadata.user_id:"${user._id}"`, fields: [ 'user_id' ], include_fields: true })).data?.[0];;
            const [ dbResult , userManagementResult ] = Promise.allSettled([
                await user.save(),
                await management.users.update({ id: userManagementUser.user_id }, { user_metadata: { status: 'active' } })
            ]);
            if (dbResult.status === 'rejected') {
                updateError = dbResult.reason;
                await management.users.update({ id: userManagementUser.user_id }, { user_metadata: { status: prevStatus } });
            }
            if (userManagementResult.status === 'rejected') {
                updateError = userManagementResult.reason;;
                user.status = prevStatus;
                await user.save();
            }

            if (!updateError) {
                res.status(200).json(user);
            }

        } catch (error) {
            updateError = error;
        }
        
        if (updateError) {
            console.error(`Error confirming user for item ${req.params.id}: ${updateError}`);
            res.status(500).send('A server error occurred.');
        }
    },

    async deleteUser(req, res) {
        // DELETE path: /users/962780438
        try {
            const [userManagementRes, res1, res2 ] = await Promise.all([
                (await management.users.getAll({ q: `user_metadata.user_id:"${req.params.id}"`, fields: [ 'user_id' ], include_fields: true })).data?.[0],
                User.findByIdAndDelete(req.params.id),
                Certification.deleteMany({ user: req.params.id })
            ]);
            console.log(`findByIdAndDelete res: ${JSON.stringify(res1)}`);

            const management = createManagementClient();

            const createUserRes = await management.users.delete({
                //id: `auth0|${res1._id}`
                id: userManagementRes.user_id,
            });

            res.status(200).send("User removed successfully!");
        } catch (error) {
            res.status(400).send(`Unable to delete user from the DB: ${error}`);
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
