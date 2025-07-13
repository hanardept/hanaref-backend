import { MongoClient } from "mongodb";
import { data as sectorsData } from "./data/sectors.js";
import { data as itemsData } from "./data/items.js";

const client = new MongoClient(process.env.MONGO_URL);
const database = client.db('test');

export const init = async () => {
    await database.collection('items').drop();
    await database.collection('sectors').drop();
    
    await database.collection('items').insertMany(itemsData);
    await database.collection('sectors').insertMany(sectorsData);
    console.log("Database initialized with test data.");
}

export const close = async () => {
    await client.close();
    console.log("Database connection closed."); 
}

export const db = database;