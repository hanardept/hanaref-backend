const UserController = require('../controllers/user_controller');

module.exports = (app) => {
    app.post('/register', UserController.createUser);
    app.post('/login', UserController.authenticateUser);
};