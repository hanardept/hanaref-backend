const { whoIsTheUser, adminAccessOnly, hanarAndAboveAccess } = require("../middleware/middleware");

const UserController = require("../controllers/user_controller");
const ItemController = require("../controllers/item_controller");
const SectorController = require("../controllers/sector_controller");
const TechnicianController = require("../controllers/technician_controller");
const CertificationController = require("../controllers/certification_controller");

module.exports = (app) => {
    // user-related routes:
    app.post("/register", UserController.createUser);
    app.post("/login", UserController.authenticateUser);
    app.post("/change-password", [whoIsTheUser, hanarAndAboveAccess], UserController.changePassword);

    // item-viewing routes:
    app.get("/items", whoIsTheUser, ItemController.getItems);
    app.get("/items/suggestions", [whoIsTheUser, adminAccessOnly], ItemController.getItemSuggestions)
    app.get("/items/download-worksheet", whoIsTheUser, ItemController.getItemsWorksheet);
    app.get("/items/:cat", whoIsTheUser, ItemController.getItemInfo);

    // item-CUD routes:
    app.post("/items", [whoIsTheUser, adminAccessOnly], ItemController.addItem);
    app.put("/items/:cat", [whoIsTheUser, adminAccessOnly], ItemController.editItem);
    app.delete("/items/:cat", [whoIsTheUser, adminAccessOnly], ItemController.deleteItem);

    // archive-related routes:
    app.post("/items/:cat/toggle-archive", [whoIsTheUser], ItemController.toggleArchive);

    // sector-viewing routes:
    app.get("/sectors", whoIsTheUser, SectorController.getFullSectors);

    // sector-CRD routes:
    app.post("/sectors", [whoIsTheUser, adminAccessOnly], SectorController.addSector);
    app.put("/sectors/:sectorname", [whoIsTheUser, adminAccessOnly], SectorController.editSectorDetails);
    app.delete("/sectors", [whoIsTheUser, adminAccessOnly], SectorController.deleteSector);

    // unused routes:
    app.post("/sectors/:sectorname", [whoIsTheUser, adminAccessOnly], SectorController.addDepartmentToSector); // not used
    app.delete("/sectors/:sectorname", [whoIsTheUser, adminAccessOnly], SectorController.deleteDepartmentFromSector); // not used

    // technician-viewing routes:
    app.get("/technicians", whoIsTheUser, TechnicianController.getTechnicians);
    app.get("/technicians/:id", whoIsTheUser, TechnicianController.getTechnicianInfo);

    // technician-CUD routes:
    app.post("/technicians", [whoIsTheUser, adminAccessOnly], TechnicianController.addTechnician);
    app.put("/technicians/:id", [whoIsTheUser, adminAccessOnly], TechnicianController.editTechnician);
    app.delete("/technicians/:id", [whoIsTheUser, adminAccessOnly], TechnicianController.deleteTechnician);

    // technician toggle archive
    app.post("/technicians/:id/toggle-archive", [whoIsTheUser], TechnicianController.toggleArchive);

    // certification-viewing routes:
    app.get("/certifications", whoIsTheUser, CertificationController.getCertifications);
    app.get("/certifications/:id", whoIsTheUser, CertificationController.getCertificationInfo);

    // technician-CUD routes:
    app.post("/certifications", [whoIsTheUser, adminAccessOnly], CertificationController.addCertification);
    app.put("/certifications/:id", [whoIsTheUser, adminAccessOnly], CertificationController.editCertification);
    app.delete("/certifications/:id", [whoIsTheUser, adminAccessOnly], CertificationController.deleteCertification);
};
