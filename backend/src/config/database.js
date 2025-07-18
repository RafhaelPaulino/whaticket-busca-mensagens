const dotenv = require("dotenv");

dotenv.config({
  path: process.env.NODE_ENV === "test" ? ".env.test" : ".env"
});

module.exports = {
  define: {
    charset: "utf8mb4",
    collate: "utf8mb4_bin"
  },
  dialect: process.env.DB_DIALECT || "mysql",
  timezone: "-03:00",
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASS || null,
  logging: false,
  dialectOptions: {
    charset: "utf8mb4"
  }
};
