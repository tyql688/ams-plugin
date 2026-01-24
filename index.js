import fs from "fs"
import { appPath } from "./lib/path.js"

logger.info(logger.yellow("- 正在载入 ams-plugin"))

if (!global.segment) global.segment = (await import("oicq")).segment

if (!global.core) {
  try {
    global.core = (await import("oicq")).core
  } catch (err) {}
}

import db from "./lib/db/index.js"
import { initResources } from "./lib/res.js"
import LoginServer from "./lib/server.js"

try {
  await db.ready
  logger.info("[ams] 数据库初始化成功")

  LoginServer.start()

  // 启动时检查资源
  await initResources()
} catch (error) {
  logger.error(`[ams] 初始化失败: ${error}`)
}

const files = fs.readdirSync(appPath).filter(file => file.endsWith(".js"))

const ret = []

files.forEach(file => {
  ret.push(import(`./apps/${file}`))
})

const retPromise = await Promise.allSettled(ret)

const apps = {}

for (const i in files) {
  const name = files[i].replace(".js", "")

  if (retPromise[i].status != "fulfilled") {
    logger.error(`[ams] 载入模块${logger.red(name)}错误`)
    logger.error(retPromise[i].reason)
    continue
  }

  apps[name] = retPromise[i].value[Object.keys(retPromise[i].value)[0]]
}

logger.info(logger.green("🌊 ams-plugin 载入成功"))

export { apps }
