const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const DepartmentSchema = new Schema({
    departmentName: {
        type: String,
        required: true,
    },
});

const SectorSchema = new Schema({
    sectorName: {
        type: String,
        required: true,
    },
    departments: [DepartmentSchema],
    visibleToPublic: Boolean,
    isMaintenance: Boolean,
});

module.exports = mongoose.model("Sector", SectorSchema);
