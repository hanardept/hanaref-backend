const { whoIsTheUser, adminAccessOnly, authenticatedAccessOnly, rolesAccessOnly, hanarAndAboveAccess } = require("../middleware/middleware");

const UserController = require("../controllers/user_controller");
const ItemController = require("../controllers/item_controller");
const SectorController = require("../controllers/sector_controller");
const TechnicianController = require("../controllers/technician_controller");
const CertificationController = require("../controllers/certification_controller");
const Role = require('../models/Role');

module.exports = (app) => {
    // user-viewing routes:
    app.get("/users", [whoIsTheUser, adminAccessOnly], UserController.getUsers);
    app.get("/users/:id", [whoIsTheUser, adminAccessOnly], UserController.getUserInfo);

    // user-CUD routes:
    app.post("/users", [whoIsTheUser, adminAccessOnly], UserController.addUser);
    // app.put("/users/:id", [whoIsTheUser, adminAccessOnly], UserController.editUser);
    app.delete("/users/:id", [whoIsTheUser, adminAccessOnly], UserController.deleteUser);

    // item-viewing routes:
    app.get("/items", [ whoIsTheUser, authenticatedAccessOnly ], ItemController.getItems);
    app.get("/items/download-worksheet", [ whoIsTheUser, adminAccessOnly ], ItemController.getItemsWorksheet);
    app.get("/items/:cat", [ whoIsTheUser, authenticatedAccessOnly ], ItemController.getItemInfo);

    // item-CUD routes:
    app.post("/items", [whoIsTheUser, rolesAccessOnly(Role.Admin, Role.Technician)], ItemController.addItem);
    app.put("/items/:cat", [whoIsTheUser, adminAccessOnly], ItemController.editItem);
    app.delete("/items/:cat", [whoIsTheUser, adminAccessOnly], ItemController.deleteItem);

    app.post("/items/:cat/url", [ whoIsTheUser, rolesAccessOnly(Role.Admin, Role.Technician)], ItemController.createFileUploadUrl);

    // archive-related routes:
    app.post("/items/:cat/toggle-archive", [whoIsTheUser, adminAccessOnly], ItemController.toggleArchive);

    // sector-viewing routes:
    app.get("/sectors", [ whoIsTheUser, authenticatedAccessOnly ], SectorController.getFullSectors);

    // sector-CRD routes:
    app.post("/sectors", [whoIsTheUser, adminAccessOnly], SectorController.addSector);
    app.put("/sectors/:sectorname", [whoIsTheUser, adminAccessOnly], SectorController.editSectorDetails);
    app.delete("/sectors", [whoIsTheUser, adminAccessOnly], SectorController.deleteSector);

    // unused routes:
    app.post("/sectors/:sectorname", [whoIsTheUser, adminAccessOnly], SectorController.addDepartmentToSector); // not used
    app.delete("/sectors/:sectorname", [whoIsTheUser, adminAccessOnly], SectorController.deleteDepartmentFromSector); // not used

    // technician-viewing routes:
    app.get("/technicians", [whoIsTheUser, rolesAccessOnly(Role.Admin, Role.Technician)], TechnicianController.getTechnicians);
    app.get("/technicians/:id", [whoIsTheUser, rolesAccessOnly(Role.Admin, Role.Technician)], TechnicianController.getTechnicianInfo);

    // technician-CUD routes:
    app.post("/technicians", [whoIsTheUser, adminAccessOnly], TechnicianController.addTechnician);
    app.put("/technicians/:id", [whoIsTheUser, adminAccessOnly], TechnicianController.editTechnician);
    app.delete("/technicians/:id", [whoIsTheUser, adminAccessOnly], TechnicianController.deleteTechnician);

    // technician toggle archive
    app.post("/technicians/:id/toggle-archive", [whoIsTheUser, adminAccessOnly], TechnicianController.toggleArchive);

    // certification-viewing routes:
    app.get("/certifications", [whoIsTheUser, rolesAccessOnly(Role.Admin, Role.Technician)], CertificationController.getCertifications);
    app.get("/certifications/download-worksheet", [whoIsTheUser, adminAccessOnly], CertificationController.getCertificationsWorksheet);
    app.get("/certifications/:id", [whoIsTheUser, rolesAccessOnly(Role.Admin, Role.Technician)], CertificationController.getCertificationInfo);

    // certification-CUD routes:
    app.post("/certifications", [whoIsTheUser, rolesAccessOnly(Role.Admin, Role.Technician)], CertificationController.addCertification);
    app.put("/certifications/:id", [whoIsTheUser, adminAccessOnly], CertificationController.editCertification);
    app.delete("/certifications/:id", [whoIsTheUser, adminAccessOnly], CertificationController.deleteCertification);
};
