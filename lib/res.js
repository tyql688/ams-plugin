import fs from "node:fs"
import path from "path"
import { resourcePath } from "./path.js"

const RESOURCE_URL = "https://cnb.cool/tyql688/waves-resources"
const RES_PATH = path.join(resourcePath, "waves-res")

async function git(args, cwd = RES_PATH) {
  const { error, stdout, stderr } = await Bot.exec(["git", ...args], {
    cwd,
    quiet: true,
    timeout: 180_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  })
  if (error) throw new Error(stderr || error.message)
  return stdout
}

/**
 * 更新资源：强制对齐远端 + 清理未跟踪文件
 */
export async function updateResources() {
  if (!fs.existsSync(RES_PATH)) {
    await git(["clone", "--depth=1", "--branch=main", RESOURCE_URL, RES_PATH], resourcePath)
    return true
  }
  const root = await git(["rev-parse", "--show-toplevel"])
  if (fs.realpathSync(root) !== fs.realpathSync(RES_PATH)) {
    throw new Error("资源目录不是独立的 Git 仓库，请检查 waves-res 安装")
  }

  await git(["fetch", "--no-tags", "origin", "main"])
  const before = await git(["rev-parse", "HEAD"])
  const after = await git(["rev-parse", "FETCH_HEAD^{commit}"])
  const dirty = await git(["status", "--porcelain"])
  await git(["reset", "--hard", after])
  await git(["clean", "-fd"])
  return before !== after || !!dirty
}

/**
 * 启动时自动检查并安装/更新资源
 * @returns {Promise<boolean>} 资源是否就绪
 */
export async function initResources() {
  const installed = fs.existsSync(RES_PATH)
  try {
    await updateResources()
    return true
  } catch (error) {
    logger.error(`[ams] 资源更新失败：${error.message}`)
    return installed
  }
}
