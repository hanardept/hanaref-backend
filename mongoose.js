const dotenv = require('dotenv');
dotenv.config();

const mongoUrl = `mongodb+srv://hanardept:${process.env.MONGO_PWD}@hanarcluster.qu3ygbk.mongodb.net/?retryWrites=true&w=majority`

const connectMongoose = async (mongoose = require("mongoose")) => {
    try {
        await mongoose.disconnect();

        mongoose.connect(
            mongoUrl,
            {
                useNewUrlParser: true,
                useUnifiedTopology: true
            }
        );
        console.log(`Database loaded!`);

        return mongoose;
    } catch (error) {
        console.error(error);
    }
}

module.exports = { connectMongoose };