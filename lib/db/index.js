import sequelize from "./connect.js"

import { User } from "./models/User.js"

const exec = async sql => {
  try {
    await sequelize.query(sql)
  } catch (err) {}
}

const initPromise = (async () => {
  try {
    await sequelize.sync({})

    // await exec("ALTER TABLE user ADD COLUMN gameData JSON DEFAULT '{}'")
  } catch (err) {
    logger.error("[ams] Database sync error:", err)
  }
})()

const db = {
  sequelize,
  User,
  ready: initPromise,
}

export default db
export { sequelize, User }
