const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const routes = require("./routes/routes");

const app = express();

// core middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

/* ---------- CORRECTED CORS SECTION ---------- */
const whitelist = [
  'http://localhost:3000',                          // For local development
  /^https:\/\/hanaref-fd006--.*\.web\.app$/,        // Matches ALL Firebase preview channels
  'https://hanaref-fd006.web.app',                   // For your live production site
  /^https:\/\/.*\.cloudfunctions\.net$/             // Allows requests from the function environment itself
];

const corsOptions = {
  origin: (origin, cb) => {
    // Allow requests with no origin like mobile apps or curl requests
    if (!origin) return cb(null, true);

    const isWhitelisted = whitelist.some(rule =>
      // Test if the origin is an exact string match or passes the regular expression test
      rule instanceof RegExp ? rule.test(origin) : rule === origin
    );

    if (isWhitelisted) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  credentials: true
};

// This handles the preflight 'OPTIONS' requests for all routes
app.options('*', cors(corsOptions));

app.use(cors(corsOptions));
/* ---------- END CORS SECTION ---------- */

routes(app);

module.exports = app;
