const { whoIsTheUser, adminAccessOnly, hanarAndAboveAccess } = require("../middleware/middleware");

const UserController = require("../controllers/user_controller");
const ItemController = require("../controllers/item_controller");
const SectorController = require("../controllers/sector_controller");

module.exports = (app) => {
    // user-related routes:
    app.post("/register", UserController.createUser);
    app.post("/login", UserController.authenticateUser);
    app.post("/change-password", [whoIsTheUser, hanarAndAboveAccess], UserController.changePassword);

    // item-viewing routes:
    app.get("/items", whoIsTheUser, ItemController.getItems);
    app.get("/items/:cat", whoIsTheUser, ItemController.getItemInfo);

    // item-CUD routes:
    app.post("/items", [whoIsTheUser, adminAccessOnly], ItemController.addItem);
    app.put("/items/:cat", [whoIsTheUser, adminAccessOnly], ItemController.editItem);
    app.delete("/items/:cat", [whoIsTheUser, adminAccessOnly], ItemController.deleteItem);

    // sector-viewing routes:
    app.get("/sectors", whoIsTheUser, SectorController.getFullSectors);

    // sector-CRD routes:
    app.post("/sectors", [whoIsTheUser, adminAccessOnly], SectorController.addSector);
    app.post("/sectors/:sectorname", [whoIsTheUser, adminAccessOnly], SectorController.addDepartmentToSector);
    app.put("/sectors/:sectorname", [whoIsTheUser, adminAccessOnly], SectorController.editSectorName);
    app.delete("/sectors", [whoIsTheUser, adminAccessOnly], SectorController.deleteSector);
    app.delete("/sectors/:sectorname", [whoIsTheUser, adminAccessOnly], SectorController.deleteDepartmentFromSector);
};
