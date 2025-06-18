const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const routes = require("./routes/routes");

const app = express();

// core middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

/* ---------- NEW CORS SECTION ---------- */
const whitelist = [
// "http://localhost:3000",                       // local dev server
  "https://hanaref-fd006--pr1-deploy-to-preview-bgerzcgi.web.app"      // Firebase preview channel
  ];

const corsOptions = {
  origin: (origin, cb) => {
    // allow Postman / server-to-server calls with no Origin header
    if (!origin || whitelist.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true                              // keep if you use cookies / auth headers
};

app.use(cors(corsOptions));
/* ---------- END CORS SECTION ---------- */

routes(app);

module.exports = app;
