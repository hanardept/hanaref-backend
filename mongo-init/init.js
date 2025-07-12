// This script will be run by MongoDB on first startup

db = db.getSiblingDB('test');

db.items.drop();
db.sectors.drop();
db.users.drop();

// Sectors
db.sectors.insertMany([
  {
    sectorName: "IT",
    departments: ["Support", "Development"]
  },
  {
    sectorName: "HR",
    departments: ["Recruitment", "Payroll"]
  }
]);

// Items
db.items.insertMany([
  {
    cat: "laptop",
    name: "Dell Latitude",
    sector: "IT",
    department: "Support",
    archived: false
  },
  {
    cat: "chair",
    name: "Ergonomic Chair",
    sector: "HR",
    department: "Payroll",
    archived: false
  }
]);

// Users
db.users.insertOne({
  username: "admin",
  password: "admin123", // In production, use hashed passwords!
  privilege: "admin"
});