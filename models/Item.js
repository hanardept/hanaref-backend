const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// const nameAndCatSchema = new Schema({
//     name: {
//         type: String,
//         required: true,
//         unique: true
//     },
//     cat: {
//         type: String,
//         required: true,
//         unique: true
//     }
// });
const nameAndCatSchema = new Schema({
  name: String,
  cat: String,
});

const itemSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  cat: {
    type: String,
    required: true,
    unique: true,
  },
  sector: {
    type: String,
    required: true,
  },
  department: {
    type: String,
    required: true,
  },
  catType: {
    type: String,
    default: "מקט רגיל",
  },
  description: String,
  imageLink: String,
  models: [nameAndCatSchema],
  accessories: [nameAndCatSchema],
  consumables: [nameAndCatSchema],
  belongsToKits: [nameAndCatSchema],
  similarItems: [nameAndCatSchema],
  kitItem: [nameAndCatSchema],
});

module.exports = mongoose.model("Item", itemSchema);
