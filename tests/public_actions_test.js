const { chai, expect, assert, server } = require("./resources/test_resources");

describe("Public user actions", function () {
    let itemCat = "";

    it("Gets items", function (done) {
        chai.request(server)
            .get("/items")
            .end((error, res) => {
                expect(error).to.be.null;
                expect(res).to.have.status(200);
                expect(res.body.length).to.be.greaterThan(0);
                itemCat = res.body[0].cat;
                return done();
            });
    });
    it("Get 0 items for bhina", function (done) {
        chai.request(server)
            .get("/items")
            .query({ sector: "בחינה" })
            .end((error, res) => {
                expect(error).to.be.null;
                expect(res).to.have.status(200);
                expect(res.body.length).to.be.eql(0);
                return done();
            });
    });
    it("Gets item information", function (done) {
        chai.request(server)
            .get(`/items/${itemCat}`)
            .end((error, res) => {
                expect(error).to.be.null;
                expect(res).to.have.status(200);
                return done();
            });
    });
    it("Gets sectors", function (done) {
        chai.request(server)
            .get("/sectors")
            .end((error, res) => {
                expect(error).to.be.null;
                expect(res).to.have.status(200);
                return done();
            });
    });
    it("Should not be able to see bhina", function (done) {
        chai.request(server)
            .get("/sectors")
            .end((error, res) => {
                expect(error).to.be.null;
                assert(!res.body.some((s) => s.sectorName === "בחינה"), "Bhina sector shown even though it should not be");
                return done();
            });
    });
    it("Should not be able to reach the change-password endpoint", function (done) {
        chai.request(server)
            .post("/change-password")
            .end((error, res) => {
                expect(res).to.have.status(401);
                return done();
            });
    });
    it("Should not be able to add an item", function (done) {
        chai.request(server)
            .post("/items")
            .end((error, res) => {
                expect(res).to.have.status(401);
                return done();
            });
    });
    it("Should not be able to update an item", function (done) {
        chai.request(server)
            .put(`/items/${itemCat}`)
            .end((error, res) => {
                expect(res).to.have.status(401);
                return done();
            });
    });
    it("Should not be able to delete an item", function (done) {
        chai.request(server)
            .delete(`/items/${itemCat}`)
            .end((error, res) => {
                expect(res).to.have.status(401);
                return done();
            });
    });
    it("Should not be able to add department to sector", function (done) {
        chai.request(server)
            .post(encodeURI("/sectors/שגרה"))
            .end((error, res) => {
                expect(res).to.have.status(401);
                return done();
            });
    });
    it("Should not be able to delete department from sector", function (done) {
        chai.request(server)
            .delete(encodeURI("/sectors/שגרה"))
            .end((error, res) => {
                expect(res).to.have.status(401);
                return done();
            });
    });
});
