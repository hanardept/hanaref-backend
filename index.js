const app = require("./app");
const { connectMongoose } = require("./mongoose");

connectMongoose();

app.listen(process.env.PORT || 5000, () => {
    console.log(`Currently listening on port ${process.env.PORT || 5000}...`);
});
