import { MongoClient } from "mongodb";
import { data as sectorsData } from "./data/sectors.js";
import { data as itemsData } from "./data/items.js";

const client = new MongoClient(process.env.MONGO_URI);
const db = client.db('test');

exports.init = () => {
    db.collection('items').drop();
    db.collection('sectors').drop();
    
    db.collection('items').insertMany(itemsData);
    db.collection('sectors').insertMany(sectorsData);
    console.log("Database initialized with test data.");
}

exports.db = db;