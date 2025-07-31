const { connectMongoose } = require('../mongoose');
const app = require("../app");
let server;

before(function(done) {
    this.timeout(10000);
    connectMongoose().then(() => {
        server = app.listen(5000, done);
    });
});

require('./admin_actions_test');
require('./hanar_actions_test');
require('./public_actions_test');

after((done) => {
    server.close(done);
});
