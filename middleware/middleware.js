const jwt = require("jsonwebtoken");
const jwksClient = require('jwks-rsa');
const Role = require("../models/Role");

const whoIsTheUser = (req, res, next) => {
    // The user can't just make requests with a req.userPrivilege="admin" that they inject on their own
    // If they will, they get intercepted by this middleware, and:
    // case 1) they have an "auth-token" header they made up --> their token is invalid because they don't know my salt --> catch
    // case 2) they don't have an "auth-token" header --> req.userPrivilege gets changed to "public"

    const token = req.header("auth-token");
    //console.log(`path: ${req.path}, token: ${req.header("auth-token")}, other: ${req.header("Auth-Token")}`);
    if (!token) {
        console.error('no token sent');
        res.status(400).send("Invalid token 0!");
        return;
    }

    const authConfig = {
        domain: process.env.AUTH0_DOMAIN,
        audience: process.env.BACKEND_URL,
    };

    console.log(`jwks url: https://${authConfig.domain}/.well-known/jwks.json`);

    

    const client = jwksClient({
        jwksUri: `https://${authConfig.domain}/.well-known/jwks.json`
    });


    // Function to get the signing key
    function getKey(header, callback) {
        client.getSigningKey(header.kid, (err, key) => {
            if (err) {
                console.log(`error get signing key: ${err}`);
            }
            const signingKey = key.getPublicKey();
            callback(null, signingKey);
        });
    }

    return jwt.verify(token, getKey, {
        audience: authConfig.audience,
        issuer: `https://${authConfig.domain}/`,
        algorithms: ['RS256']
    }, (error, userInfo) => { // userInfo: { _id: ..., privilege: "admin"/"hanar" }
        if (error) {
            console.log(`invalid token: ${error}`);
            res.status(400).send("Invalid token 1!");
        } else {
            req.userId = userInfo[`${process.env.AUTH0_NAMESPACE}/user_id`];
            req.userPrivilege = userInfo[`${process.env.AUTH0_NAMESPACE}/roles`]?.[0];
            next();
        }
    });
};

const rolesAccessOnly = (roles) => (req, res, next) => {
    if (roles.includes(req.userPrivilege)) {
        console.log(`approved to use endpoint!`);
        next();
    } else {
        console.log(`NOT approved to use endpoint! allowed roles: ${JSON.stringify(roles)}, current role: ${req.userPrivilege}`);
        res.status(401).send("You are unauthorized to access this endpoint.");
    }  
}

const adminAccessOnly = (req, res, next) => {
    if (req.userPrivilege === "admin") {
        next();
    } else {
        res.status(401).send("You are unauthorized to access this endpoint.");
    }
};

const authenticatedAccessOnly = (req, res, next) => rolesAccessOnly(Object.values(Role))(req, res, next);

const hanarAndAboveAccess = (req, res, next) => {
    if (["admin", "hanar"].includes(req.userPrivilege)) {
        next();
    } else {
        res.status(401).send("You are unauthorized to access this endpoint.");
    }
};

module.exports = {
    whoIsTheUser,
    rolesAccessOnly,
    adminAccessOnly,
    authenticatedAccessOnly,
    hanarAndAboveAccess,
};
