const { chai, expect, adminUname, adminPwd } = require("./resources/test_resources");
const app = require("../app");

const fakeItem = {
    name: "מנשם",
    cat: "000000000",
    sector: "בחינה",
    department: "מנשמים",
    catType: "מקט רגיל",
    description: "מנשם לדוגמה",
    imageLink: "https://imgur.com/abc",
    models: [{ name: "VentilatorA", cat: "123V" }],
    accessories: [{ name: "צינור", cat: "111111111" }],
    consumables: [{ name: "פילטר", cat: "222222222" }],
    belongsToKits: [{ name: "ערכת מנשם", cat: "121121121" }],
    similarItems: [{ name: "מנשם שני", cat: "010101010" }],
};
const fakeSector = {
    sectorName: "מדור1",
    departments: [{ departmentName: "תחום1" }, { departmentName: "תחום2" }, { departmentName: "תחום3" }],
    visibleToPublic: true,
};

describe("Admin actions", function () {
    let authToken = "";
    let server;

    before((done) => {
        server = app.listen(5000, done);
    });

    after((done) => {
        server.close(done);
    });

    it("Logs admin in", function (done) {
        chai.request(server)
            .post("/login")
            .send({ username: adminUname, password: adminPwd })
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .end((error, res) => {
                expect(error).to.be.null;
                expect(res).to.have.status(200);
                authToken = res.body.authToken;
                return done();
            });
    });
    it("Adds an item", function (done) {
        chai.request(server)
            .post("/items")
            .send(fakeItem)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token", authToken)
            .end((error, res) => {
                expect(error).to.be.null;
                expect(res).to.have.status(200);
                return done();
            });
    });
    it("Updates item details - change sector to bhina", function (done) {
        chai.request(server)
            .put("/items/000000000")
            .send({ sector: "בחינה" })
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token", authToken)
            .end((error, res) => {
                expect(error).to.be.null;
                expect(res).to.have.status(200);
                return done();
            });
    });
    it("Gets items", function (done) {
        chai.request(server)
            .get("/items")
            .set("auth-token", authToken)
            .end((error, res) => {
                expect(error).to.be.null;
                expect(res).to.have.status(200);
                expect(res.body.length).to.be.greaterThan(0);
                return done();
            });
    });
    it("Deletes item", function (done) {
        chai.request(server)
            .delete("/items/000000000")
            .set("auth-token", authToken)
            .end((error, res) => {
                expect(error).to.be.null;
                expect(res).to.have.status(200);
                return done();
            });
    });
    it("Gets sectors", function (done) {
        chai.request(server)
            .get("/sectors")
            .set("auth-token", authToken)
            .end((error, res) => {
                expect(error).to.be.null;
                expect(res).to.have.status(200);
                return done();
            });
    });
    it("Adds a sector", function (done) {
        chai.request(server)
            .post("/sectors")
            .set("auth-token", authToken)
            .send(fakeSector)
            .end((error, res) => {
                expect(error).to.be.null;
                expect(res).to.have.status(200);
                return done();
            });
    });
    it("Adds a department to a given sector", function (done) {
        chai.request(server)
            .post(encodeURI("/sectors/מדור1"))
            .set("auth-token", authToken)
            .send({ departmentName: "תחום4" })
            .end((error, res) => {
                expect(error).to.be.null;
                expect(res).to.have.status(200);
                return done();
            });
    });
    it("Deletes a department from given sector", function (done) {
        chai.request(server)
            .delete(encodeURI("/sectors/מדור1"))
            .set("auth-token", authToken)
            .send({ departmentName: "תחום4" })
            .end((error, res) => {
                expect(error).to.be.null;
                expect(res).to.have.status(200);
                return done();
            });
    });
    it("Deletes a sector", function (done) {
        chai.request(server)
            .delete("/sectors")
            .set("auth-token", authToken)
            .send({ sectorName: "מדור1" })
            .end((error, res) => {
                expect(error).to.be.null;
                expect(res).to.have.status(200);
                return done();
            });
    });
});
