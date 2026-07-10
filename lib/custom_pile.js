import fs from "fs"
import path from "path"
import { CUSTOM_PILE_ROLE_ALIASES, CUSTOM_PILE_SHARE_GROUPS } from "./constants.js"

const IMAGE_RE = /\.(png|jpg|jpeg|webp)$/i

/**
 * 返回角色共用的自定义立绘组。
 * 未声明共享关系的普通角色只返回自身 ID。
 */
export function getCustomPileRoleIds(roleId) {
  const id = Number(roleId)
  if (!Number.isFinite(id)) return [roleId]

  const explicit = CUSTOM_PILE_SHARE_GROUPS.find(group => group.includes(id))
  return explicit ? [...explicit] : [id]
}

/**
 * 自定义立绘管理命令专用别名。
 * 男女主在资源中同名，不能依赖角色列表顺序判断性别。
 */
export function getCustomPileAliasRoleId(name) {
  return CUSTOM_PILE_ROLE_ALIASES[String(name).trim()] ?? null
}

/**
 * 聚合共享组内所有目录，兼容改造前已经落在成员 ID 目录里的图片。
 * 相同哈希 ID 合并展示；paths 保留全部副本供删除命令一次清理。
 */
export function listCustomPileFiles(customPilePath, roleId) {
  const files = new Map()
  for (const id of getCustomPileRoleIds(roleId)) {
    const dir = path.join(customPilePath, String(id))
    if (!fs.existsSync(dir)) continue
    for (const file of fs.readdirSync(dir).filter(name => IMAGE_RE.test(name))) {
      const fullPath = path.join(dir, file)
      const fileId = path.parse(file).name
      const current = files.get(fileId)
      if (current) {
        current.paths.push(fullPath)
      } else {
        files.set(fileId, {
          file,
          id: fileId,
          paths: [fullPath],
          url: `file://${fullPath}`.replace(/\\/g, "/"),
        })
      }
    }
  }
  return [...files.values()].sort((a, b) => a.id.localeCompare(b.id))
}

export function findCustomPileFile(customPilePath, roleId, input) {
  return listCustomPileFiles(customPilePath, roleId).find(
    file => file.file === input || file.id === input,
  )
}

export function randomCustomPile(customPilePath, roleId) {
  const files = listCustomPileFiles(customPilePath, roleId)
  if (files.length === 0) return null
  const index = Math.floor(Math.random() * files.length)
  return files[index].url
}
