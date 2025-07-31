const mongoose = require("mongoose");
const dotenv = require('dotenv');
dotenv.config();

const mongoUrl = process.env.MONGO_URL

const connectMongoose = async () => {
    try {
        await mongoose.connect(
            mongoUrl,
            {
                useNewUrlParser: true,
                useUnifiedTopology: true
            }
        );
        console.log(`Database loaded!`);
    } catch (error) {
        console.error(error);
    }
}

module.exports = { connectMongoose, mongoose };