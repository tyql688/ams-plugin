import fs from "fs"
import path from "path"
import { Sequelize } from "sequelize"
import sqlite3 from "sqlite3"
import { dataPath } from "../path.js"

const DB_FILE = path.join(dataPath, "ams.db")
if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true })

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: DB_FILE,
  logging: false,
  define: {
    freezeTableName: true,
    timestamps: true,
  },
  dialectOptions: {
    mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  },
})

const optimize = async () => {
  try {
    await sequelize.authenticate()
    await sequelize.query("PRAGMA journal_mode = WAL;")
    await sequelize.query("PRAGMA synchronous = NORMAL;")
    await sequelize.query("PRAGMA busy_timeout = 5000;")
  } catch (e) {
    logger.error("[ams] DB Connection Failed:", e)
  }
}

optimize()

export default sequelize
