const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const token = req.header('auth-token');
    if (!token) return res.status(401).send('Access denied!');

    try {
        const userInfo = jwt.verify(token, process.env.JWT_TOKEN_SECRET);
        req.userInfo = userInfo; // { _id: ..., privilege: "all"/"p1"/... }
        next();
    } catch (error) {
        res.status(400).send('Invalid token!');
    }
}

// 3 privileges: 
// admin: view + add + edit + delete
// hanar: view everything
// no user: view all except Bimal & B7ina items

const adminOnlyMiddleware = (req, res, next) => {

}

const UserController = require('../controllers/user_controller');
const ItemController = require('../controllers/item_controller');

module.exports = (app) => {
    app.post('/change-password', authMiddleware, UserController.changePassword);

    app.get('/items', authMiddleware, ItemController.getItems);
    app.post('/items', [authMiddleware, adminOnlyMiddleware], ItemController.addItem);

    app.get('/items/:cat', authMiddleware, ItemController.getItemInfo);
    app.put('/items/:cat', authMiddleware, ItemController.editItem);
    app.delete('/items/:cat', authMiddleware, ItemController.deleteItem);
}