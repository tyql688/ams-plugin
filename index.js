import fs from "fs"
import { appPath } from "./lib/path.js"

logger.info(logger.yellow("- 正在载入 ams-plugin"))

if (!global.segment) global.segment = (await import("oicq")).segment

if (!global.core) {
  try {
    global.core = (await import("oicq")).core
  } catch (err) {}
}

import { initResources } from "./lib/res.js"

// 启动时检查资源
// 注意：db、apps 等模块静态依赖 #waves.*（指向 waves-res 内部文件），
// 必须先确保资源就绪，再用动态 import 加载，否则首次安装时会 ERR_MODULE_NOT_FOUND
const resReady = await initResources()

const apps = {}

if (resReady) {
  try {
    const { default: db } = await import("./lib/db/index.js")
    await db.ready
    logger.info("[ams] 数据库初始化成功")

    const { default: LoginServer } = await import("./lib/server.js")
    LoginServer.start()
  } catch (error) {
    logger.error(`[ams] 初始化失败: ${error}`)
  }

  const files = fs.readdirSync(appPath).filter(file => file.endsWith(".js"))

  const ret = []

  files.forEach(file => {
    ret.push(import(`./apps/${file}`))
  })

  const retPromise = await Promise.allSettled(ret)

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
} else {
  logger.error(
    "[ams] 资源包安装失败，ams-plugin 未加载，请检查网络后重启，或手动克隆资源库到 plugins/ams-plugin/resources/waves-res",
  )
}

export { apps }
