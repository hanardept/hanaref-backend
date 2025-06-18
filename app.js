const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const routes = require("./routes/routes");

const app = express();

// core middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

/* ---------- CORS SECTION ---------- */
const whitelist = [
  'http://localhost:3000',                          // local dev
  /^https:\/\/hanaref-fd006--.*\.web\.app$/,        // any Firebase preview
  'https://hanaref-fd006.web.app'                   // live site
  // add your Cloud Run URL if the UI calls it directly:
  // /^https:\/\/.*\.run\.app$/
];

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);             // Postman & cron jobs
    const ok = whitelist.some(rule =>
      rule instanceof RegExp ? rule.test(origin) : rule === origin
    );
    return ok ? cb(null, true) : cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  credentials: true
};

app.use(cors(corsOptions));                          // keep this **before** routes
/* ---------- END CORS SECTION ---------- */

routes(app);

module.exports = app;
