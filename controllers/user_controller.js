const User = require("../models/User");
const Role = require("../models/Role");
const NotificationType = require("../models/NotificationType");
const Certification = require("../models/Certification");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { decodeItems, getUserDisplayName } = require("../functions/helpers");
const { ManagementClient } = require('auth0');
var generator = require('generate-password');
const { notifyRole } = require("../functions/helpers");


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
                    { firstName: 1, lastName: 1, username: 1, role: 1, _id: 1 },
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
                { _id: 1, firstName: 1, lastName: 1, username: 1, email: 1, role: 1, association: 1, status: 1 });

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

        const user = new User({
            firstName: '',
            lastName: '',
            username: req.body.username,
            email: req.body.email,
            role: Role.Viewer,
            status: 'registered',
        });

        //DEBUG:
            const allUsers = (await management.users.getAll({ fields: [ 'user_id' ], include_fields: true })).data;
            console.log(`all auth0 users: ${JSON.stringify(allUsers)}`);
            console.log(`query: ${`username:"${user.username}"`}`);
        //
        const userManagementUser = (await management.users.getAll({ q: `username:"${user.username}"`, fields: [ 'user_id' ], include_fields: true })).data?.[0];

        try {
            await Promise.all([
                user.save(),
                management.users.update({ id: userManagementUser.user_id }, { user_metadata: { user_id: user._id, role: user.role } })
            ]);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(JSON.stringify({ userId: user._id }));

            notifyRole({ 
                role: Role.Admin,
                subject: "משתמש חדש ממתין לאישור",
                message: `המשתמש {user.email} ממתין לאישור מנהל`,
                type: NotificationType.NewUserWaitingForConfirmation,
                data: {
                    user: {
                        _id: user._id,
                        email: req.body.email
                    }
                }
            });
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
                { username: req.body.username },
                { email: req.body.email }
            ]
        });
        if (userExistsInDB) return res.status(400).send("User already registered!");

        const user = new User({
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
                name: [req.body.firstName, req.body.lastName].filter(n => n).join(' '),
                password,
                connection: 'Username-Password-Authentication',
                user_metadata: {
                    user_id: user._id,
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

    async editUser(req, res) {
        // PUT path: /users/962780438
        const { firstName, lastName, role, username, email, association } = req.body;

        try {
            const management = createManagementClient();
            const [ originalUser, managementUser ] = await Promise.all([
                User.findByIdAndUpdate(req.params.id, { firstName, lastName, role, username, email, association }),
                (await management.users.getAll({ q: `user_metadata.user_id:"${req.params.id}"`, fields: [ 'user_id' ], include_fields: true })).data?.[0]
            ]);

            const managementFields = [ 'role', 'email', 'username', 'firstName', 'lastName' ];
            const idFields = [ 'username', 'email'] ;
            const changedFields = managementFields.filter(field => originalUser[field] !== req.body[field])
            if (changedFields.length) {
                const nonIdFields = changedFields.filter(field => !idFields.includes(field));
                const nonIdChanges = nonIdFields.reduce((obj, field) => {
                    switch (field) {
                        case 'firstName':
                            return { ...obj, given_name: req.body.firstName, name: [req.body.firstName, req.body.lastName ?? originalUser.lastName].filter(n => n).join(' ') };
                        case 'lastName':
                            return { ...obj, family_name: req.body.lastName, name: [req.body.firstName ?? originalUser.firstName, req.body.lastName].filter(n => n).join(' ') };
                        case 'role':
                            return { ...obj, user_metadata: { ...obj.user_metadata, role: req.body.role } };
                        default:
                            return { ...obj, [field]: req.body[field] };
                    }
                }, {});
                // Email and username cannot be updated simultaneously in Auth0, so we divide the auth0 update to 2 steps
                let changeObjs = idFields
                    .filter(field => originalUser[field] !== req.body[field])
                    .map(field => ({ [field]: req.body[field] }));
                if (changeObjs.length) {
                    changeObjs[0] = { ...changeObjs[0], ...nonIdChanges };
                } else {
                    changeObjs = [ nonIdChanges ];
                }
                console.log(`auth0 change objs: ${JSON.stringify(changeObjs)}`);
                for (const changeObj of changeObjs) {
                    await management.users.update({ id: managementUser.user_id }, changeObj)
                }
            }
            
            res.status(200).send("User updated successfully!");
        } catch (error) {
            res.status(400).send(`Failure updating user: ${error}`);
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
            const [ dbResult , userManagementResult ] = await Promise.allSettled([
                user.save(),
                management.users.update({ id: userManagementUser.user_id }, { user_metadata: { status: 'active' } })
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
            const management = createManagementClient();
            const [userManagementRes, user, res2 ] = await Promise.all([
                (await management.users.getAll({ q: `user_metadata.user_id:"${req.params.id}"`, fields: [ 'user_id' ], include_fields: true })).data?.[0],
                User.findByIdAndDelete(req.params.id),
                Certification.deleteMany({ user: req.params.id })
            ]);
            console.log(`findByIdAndDelete res: ${JSON.stringify(res1)}`);

            const createUserRes = await management.users.delete({
                id: userManagementRes.user_id,
            });

            if (user.status === 'registered') {
                const admin = User.findById(req.userId, { email: 1, firstName: 1, lastName: 1 })
                .then(admin => 
                    notifyRole({
                        role: Role.Admin,
                        exceptedUser: {
                            user: admin,
                            message: `המשתמש {user.email} שנרשם, נמחק על-ידך`,
                        },
                        type:  NotificationType.NewUserDeleted,
                        subject: 'משתמש שנרשם נמחק',
                        message: `המשתמש {user.email} שנרשם, נמחק ע"י המנהל ${getUserDisplayName(admin)}`,
                        data: ({ user: req.params.id }),
                        deletedNotifications: {
                            type: NotificationType.NewUserWaitingForConfirmation,
                        }
                    })
                );
            }

            res.status(200).send("User removed successfully!");
        } catch (error) {
            console.log(`Error deleting user: ${error}`);
            res.status(400).send('Unable to delete user');
        }
    },
};
