// This script will be run by MongoDB on first startup

db = db.getSiblingDB('test');

db.items.drop();
db.sectors.drop();
db.users.drop();

// Sectors
db.sectors.insertMany([
  {
    sectorName: "ביו-הנדסה (מכשור רפואת שגרה)",
    departments: ["אודיולוגיה", "דימות", "כירורגיה", "מעבדות", "עיניים - אופתלמולוגיה"]
  },
  {
    sectorName: "פיתוח",
    departments: ["דפיברילטורים", "חדר ניתוח", "משאבות", "ציוד לוגיסטי"]
  }
]);

// Items
db.items.insertMany([
  {
    "name": "מיקרופון בודק עם אוזניה",
    "cat": "962007350",
    "sector": "ביו-הנדסה (מכשור רפואת שגרה)",
    "department": "אודיולוגיה",
    "catType": "מקט רגיל",
    "description": "מיקרופון עבור המטפל בבדיקת אודיומטריה",
    "imageLink": "https://hanaref-bucket.s3.amazonaws.com/hanaref-images/%D7%AA%D7%9E%D7%95%D7%A0%D7%95%D7%AA+-+%D7%90%D7%95%D7%93%D7%99%D7%95%D7%9C%D7%95%D7%92%D7%99%D7%94/%D7%90%D7%95%D7%93%D7%99%D7%90%D7%95%D7%9C%D7%95%D7%92%D7%99%D7%94/962007350+-+%D7%9E%D7%99%D7%A7%D7%A8%D7%95%D7%A4%D7%95%D7%9F+%D7%91%D7%95%D7%93%D7%A7+%D7%A2%D7%9D+%D7%90%D7%95%D7%96%D7%A0%D7%99%D7%94.jpeg",
    "qaStandardLink": "",
    "models": [
      {
        "name": "Interacoustics: Monitor Headset with boom PC-131 stereo headset",
        "cat": "8010870",
      }
    ],
    "accessories": [],
    "consumables": [],
    "belongsToKits": [],
    "similarItems": [],
    "kitItem": [],
  },{
    "name": "משחת ניקוי לבדיקת ABR",
    "cat": "962006167",
    "sector": "ביו-הנדסה (מכשור רפואת שגרה)",
    "department": "אודיולוגיה",
    "catType": "מקט רגיל",
    "description": "משחה לניקוי מכשיר ABR",
    "imageLink": "https://hanaref-bucket.s3.amazonaws.com/hanaref-images/%D7%AA%D7%9E%D7%95%D7%A0%D7%95%D7%AA+-+%D7%90%D7%95%D7%93%D7%99%D7%95%D7%9C%D7%95%D7%92%D7%99%D7%94/%D7%90%D7%95%D7%93%D7%99%D7%90%D7%95%D7%9C%D7%95%D7%92%D7%99%D7%94/962006167+-+%D7%9E%D7%A9%D7%97%D7%AA+%D7%A0%D7%99%D7%A7%D7%95%D7%99+%D7%9C%D7%91%D7%93%D7%99%D7%A7%D7%AA+ABR.JPG",
    "qaStandardLink": "",
    "models": [
      {
        "name": "Weaver and Company - Nuprep",
        "cat": "10-30",
      },
      {
        "name": "Spes Medica",
        "cat": "Nprep120T",
      }
    ],
    "accessories": [],
    "consumables": [],
    "belongsToKits": [],
    "similarItems": [],
    "kitItem": [],
  },{
    "name": "אודיומטר - אוזניות עם מגן אקוסטי",
    "cat": "962006361",
    "sector": "ביו-הנדסה (מכשור רפואת שגרה)",
    "department": "אודיולוגיה",
    "catType": "מקט רגיל",
    "description": "אוזניות לבדיקת אודיומטריה",
    "imageLink": "https://hanaref-bucket.s3.amazonaws.com/Hanaref/%D7%9E%D7%93%D7%95%D7%A8+%D7%91%D7%99%D7%95-%D7%94%D7%A0%D7%93%D7%A1%D7%94/%D7%90%D7%95%D7%93%D7%99%D7%95%D7%9C%D7%95%D7%92%D7%99%D7%94/962006361+-+%D7%90%D7%95%D7%93%D7%99%D7%95%D7%9E%D7%98%D7%A8+-+%D7%90%D7%95%D7%96%D7%A0%D7%99%D7%95%D7%AA+%D7%A2%D7%9D+%D7%9E%D7%92%D7%9F+%D7%90%D7%A7%D7%95%D7%A1%D7%98%D7%99/962006361+-+%D7%90%D7%95%D7%93%D7%99%D7%95%D7%9E%D7%98%D7%A8+-+%D7%90%D7%95%D7%96%D7%A0%D7%99%D7%95%D7%AA+%D7%A2%D7%9D+%D7%9E%D7%92%D7%9F+%D7%90%D7%A7%D7%95%D7%A1%D7%98%D7%99.JPG",
    "qaStandardLink": "",
    "models": [
      {
        "name": "Interacoustics",
        "cat": "8102257",
      }
    ],
    "accessories": [],
    "consumables": [],
    "belongsToKits": [],
    "similarItems": [],
    "kitItem": [],
  },{
    "name": "לחצן נבדק לאודיומטר",
    "cat": "962007368",
    "sector": "ביו-הנדסה (מכשור רפואת שגרה)",
    "department": "אודיולוגיה",
    "catType": "מקט רגיל",
    "description": "לחץ עבור הנבדק בבדיקת אודיולוגיה",
    "imageLink": "https://hanaref-image-url.com/image1.JPG",
    "qaStandardLink": "",
    "models": [
      {
        "name": "GSI",
        "cat": "7874-0156",
      },
      {
        "name": "Inventis",
        "cat": "8011091",
      },
      {
        "name": "Interacoustics",
        "cat": "A085",
      }
    ],
    "accessories": [],
    "consumables": [],
    "belongsToKits": [],
    "similarItems": [],
    "kitItem": [],
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
  password: "$2a$12$GUQbLPQmFPcxnlpZoyJaqePs8XB6PBrmACuNzyVzfzdkV8R3mQnNe", // admin123
  privilege: "admin"
});