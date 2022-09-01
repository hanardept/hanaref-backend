const jwt = require('jsonwebtoken');

const whoIsTheUser = (req, res, next) => {
    // The user can't just make requests with a req.userPrivilege="admin" that they inject on their own
    // If they will, they get intercepted by this middleware, and:
    // case 1) they have an "auth-token" header they made up --> their token is invalid because they don't know my salt --> catch
    // case 2) they don't have an "auth-token" header --> req.userPrivilege gets changed to "public"

    const token = req.header('auth-token');
    if (!token) {
        req.userPrivilege = "public";
        return next();
    }

    try {
        const userInfo = jwt.verify(token, process.env.JWT_TOKEN_SECRET); // userInfo: { _id: ..., privilege: "admin"/"hanar" }
        req.userId = userInfo._id; 
        req.userPrivilege = userInfo.privilege;
        next();
    } catch (error) {
        res.status(400).send('Invalid token!');
    }
};

const adminAccessOnly = (req, res, next) => {
    if (req.userPrivilege === "admin") {
        next();
    } else {
        res.status(401).send("You are unauthorized to access this endpoint.")
    }
};

const hanarAndAboveAccess = (req, res, next) => {
    if (["admin", "hanar"].includes(req.userPrivilege)) {
        next();
    } else {
        res.status(401).send("You are unauthorized to access this endpoint.")
    }
};

module.exports = {
    whoIsTheUser,
    adminAccessOnly,
    hanarAndAboveAccess
}
