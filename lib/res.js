import { exec } from "child_process"
import fs from "node:fs"
import path from "path"
import { resourcePath } from "./path.js"

const RESOURCE_URL = "https://cnb.cool/tyql688/waves-resources"
const RES_PATH = path.join(resourcePath, "waves-res")

/**
 * 执行命令的 Promise 封装
 */
function execPro(cmd, opts = {}) {
  return new Promise(resolve => {
    exec(cmd, opts, (error, stdout, stderr) => {
      resolve({ error, stdout, stderr })
    })
  })
}

/**
 * 更新资源
 * @param {boolean} isForce - 是否强制更新
 * @param {boolean} silent - 是否静默模式（启动时使用）
 */
export async function updateResources(isForce = false, silent = false) {
  const exists = fs.existsSync(RES_PATH)
  let command = ""
  let result = {
    success: false,
    message: "",
    filesChanged: 0,
  }

  try {
    if (exists) {
      // 资源已存在，执行更新
      command = isForce ? "git checkout . && git pull" : "git pull"
      if (!silent) logger.info(`[ams] 执行资源更新: ${command}`)

      const ret = await execPro(command, { cwd: RES_PATH })

      if (ret.error) {
        result.message = `更新失败: ${ret.error.message}`
        logger.error(`[ams] 资源更新失败: ${ret.error.message}`)
      } else if (/(Already up[ -]to[ -]date|已经是最新的)/.test(ret.stdout)) {
        result.success = true
        result.message = "已是最新"
        if (!silent) logger.info("[ams] 资源已是最新")
      } else {
        const numRet = /(\d+) files? changed/.exec(ret.stdout)
        result.success = true
        result.filesChanged = numRet ? parseInt(numRet[1]) : 0
        result.message = result.filesChanged
          ? `更新成功，改动了${result.filesChanged}个文件`
          : "更新成功"
        logger.mark(`[ams] 资源${result.message}`)
      }
    } else {
      // 资源不存在，执行克隆
      command = `git clone ${RESOURCE_URL} "${RES_PATH}" --depth=1`
      logger.info(`[ams] 执行资源安装: git clone ${RESOURCE_URL}`)

      const ret = await execPro(command)

      if (ret.error) {
        result.message = `安装失败: ${ret.error.message}`
        logger.error(`[ams] 资源安装失败: ${ret.error.message}`)
      } else {
        result.success = true
        result.message = "首次安装成功"
        logger.mark("[ams] 资源包首次安装成功")
      }
    }
  } catch (error) {
    result.message = `异常: ${error.message}`
    logger.error(`[ams] 资源处理异常: ${error.message}`)
  }

  return result
}

/**
 * 启动时自动检查并安装资源
 */
export async function initResources() {
  const exists = fs.existsSync(RES_PATH)

  if (!exists) {
    logger.info("[ams] 未检测到资源包，开始自动安装...")
    await updateResources(false, false)
  } else {
    logger.info("[ams] 资源包已存在, 开始自动更新...")
    await updateResources(true, false)
  }
}
