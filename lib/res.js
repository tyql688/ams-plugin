import { exec } from "child_process"
import fs from "node:fs"
import path from "path"
import { resourcePath } from "./path.js"

const RESOURCE_URL = "https://cnb.cool/tyql688/waves-resources"
const RES_PATH = path.join(resourcePath, "waves-res")

function execPro(cmd, opts = {}) {
  return new Promise(resolve => {
    exec(cmd, opts, (error, stdout, stderr) => {
      resolve({ error, stdout, stderr })
    })
  })
}

async function getCommitId() {
  return (await execPro("git rev-parse --short HEAD", { cwd: RES_PATH })).stdout?.trim() || ""
}

/**
 * 更新资源：强制对齐远端 + 清理未跟踪文件
 * @param {boolean} silent - 静默模式（启动时使用）
 */
export async function updateResources(silent = false) {
  const result = { success: false, message: "", filesChanged: 0 }

  try {
    if (!fs.existsSync(RES_PATH)) {
      logger.info(`[ams] 安装资源: git clone ${RESOURCE_URL}`)
      const ret = await execPro(`git clone ${RESOURCE_URL} "${RES_PATH}" --depth=1`)
      if (ret.error) {
        result.message = `安装失败: ${ret.error.message}`
        logger.error(`[ams] 资源安装失败: ${ret.error.message}`)
      } else {
        result.success = true
        result.message = "首次安装成功"
        logger.mark("[ams] 资源包首次安装成功")
      }
      return result
    }

    const before = await getCommitId()
    const ret = await execPro("git fetch --all --prune && git reset --hard @{u} && git clean -fd", {
      cwd: RES_PATH,
    })
    if (ret.error) {
      result.message = `更新失败: ${ret.error.message}`
      logger.error(`[ams] 资源更新失败: ${ret.error.message}`)
      return result
    }

    const after = await getCommitId()
    result.success = true
    if (before === after) {
      result.message = "已是最新"
      if (!silent) logger.info("[ams] 资源已是最新")
    } else {
      const diff = (await execPro(`git diff --name-only ${before} ${after}`, { cwd: RES_PATH })).stdout || ""
      result.filesChanged = diff.split("\n").filter(Boolean).length
      result.message = result.filesChanged ? `更新成功，改动了${result.filesChanged}个文件` : "更新成功"
      logger.mark(`[ams] 资源${result.message}`)
    }
  } catch (error) {
    result.message = `异常: ${error.message}`
    logger.error(`[ams] 资源处理异常: ${error.message}`)
  }

  return result
}

/**
 * 启动时自动检查并安装/更新资源
 * @returns {Promise<boolean>} 资源是否就绪
 */
export async function initResources() {
  if (!fs.existsSync(RES_PATH)) {
    logger.info("[ams] 未检测到资源包，开始自动安装...")
    return (await updateResources(false)).success
  }
  logger.info("[ams] 资源包已存在，开始自动更新...")
  await updateResources(false)
  return true
}
