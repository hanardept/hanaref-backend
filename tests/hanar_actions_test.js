const { chai, expect, assert, hanarUname, hanarPwd } = require("./resources/test_resources");

describe("Hanar user actions", function () {
    let authToken = "";
    let bhinaItemCat = ""; // will be changed to a bhina-item catalog number

    it("Logs hanar user in", function (done) {
        chai.request("http://localhost:5000")
            .post("/login")
            .send({ username: hanarUname, password: hanarPwd })
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .end((error, res) => {
                expect(error).to.be.null;
                expect(res).to.have.status(200);
                authToken = res.body.authToken;
                return done();
            });
    });
    it("Gets sectors", function (done) {
        chai.request("http://localhost:5000")
            .get("/sectors")
            .set("auth-token", authToken)
            .end((error, res) => {
                expect(error).to.be.null;
                expect(res).to.have.status(200);
                return done();
            });
    });
    it("Gets items in general", function (done) {
        chai.request("http://localhost:5000")
            .get("/items")
            .set("auth-token", authToken)
            .end((error, res) => {
                expect(error).to.be.null;
                expect(res).to.have.status(200);
                expect(res.body.length).to.be.greaterThan(0);
                return done();
            });
    });
    it("Gets bhina items", function (done) {
        chai.request("http://localhost:5000")
            .get("/items")
            .query({ sector: "בחינה" })
            .set("auth-token", authToken)
            .end((error, res) => {
                expect(error).to.be.null;
                expect(res).to.have.status(200);
                expect(res.body.length).to.be.greaterThan(0);
                bhinaItemCat = res.body[0].cat;
                return done();
            });
    });
    it("Gets bhina item information", function (done) {
        chai.request("http://localhost:5000")
            .get(`/items/${bhinaItemCat}`)
            .set("auth-token", authToken)
            .end((error, res) => {
                expect(error).to.be.null;
                expect(res).to.have.status(200);
                return done();
            });
    });

    it("Should not be able to add an item", function (done) {
        chai.request("http://localhost:5000")
            .post("/items")
            .set("auth-token", authToken)
            .end((error, res) => {
                expect(res).to.have.status(401);
                return done();
            });
    });
    it("Should not be able to update an item", function (done) {
        chai.request("http://localhost:5000")
            .put(`/items/${bhinaItemCat}`)
            .set("auth-token", authToken)
            .end((error, res) => {
                expect(res).to.have.status(401);
                return done();
            });
    });
    it("Should not be able to delete an item", function (done) {
        chai.request("http://localhost:5000")
            .delete(`/items/${bhinaItemCat}`)
            .set("auth-token", authToken)
            .end((error, res) => {
                expect(res).to.have.status(401);
                return done();
            });
    });
    it("Should not be able to add department to sector", function (done) {
        chai.request("http://localhost:5000")
            .post(encodeURI("/sectors/בחינה"))
            .set("auth-token", authToken)
            .end((error, res) => {
                expect(res).to.have.status(401);
                return done();
            });
    });
    it("Should not be able to delete department from sector", function (done) {
        chai.request("http://localhost:5000")
            .delete(encodeURI("/sectors/בחינה"))
            .set("auth-token", authToken)
            .end((error, res) => {
                expect(res).to.have.status(401);
                return done();
            });
    });
});
