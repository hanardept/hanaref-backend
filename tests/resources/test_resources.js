const dotenv = require('dotenv');
const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('../../app');

const { expect, assert } = chai;
chai.use(chaiHttp);

dotenv.config();
const adminUname = process.env.ADMIN_USERNAME;
const adminPwd = process.env.ADMIN_PWD;
const hanarUname = process.env.HANAR_USERNAME;
const hanarPwd = process.env.HANAR_PWD;

const server = app;

module.exports = {
    chai,
    expect,
    assert,
    adminUname,
    adminPwd,
    hanarUname,
    hanarPwd,
    server
};