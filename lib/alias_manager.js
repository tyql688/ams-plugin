import fs from "fs"
import path from "path"
import _ from "lodash"
import { wavesDataMap, customAliasPath } from "./path.js"

class AliasManager {
  constructor() {
    this.typeMap = {
      role: {
        sys: wavesDataMap.alias ? path.join(wavesDataMap.alias, "role.json") : "",
        custom: path.join(customAliasPath, "role.json"),
        name: "角色"
      },
      weapon: {
        sys: wavesDataMap.alias ? path.join(wavesDataMap.alias, "weapon.json") : "",
        custom: path.join(customAliasPath, "weapon.json"),
        name: "武器"
      },
      echo: {
        sys: wavesDataMap.alias ? path.join(wavesDataMap.alias, "echo.json") : "",
        custom: path.join(customAliasPath, "echo.json"),
        name: "声骸"
      }
    }
    
    // 内存缓存
    // aliasMap: { type: { alias: realName } }
    this.aliasMap = {}
    // dataMap: { type: { realName: [alias...] } }
    this.dataMap = {}
    
    this.init()
  }

  init() {
    for (const type in this.typeMap) {
      this.loadType(type)
    }
  }

  loadType(type) {
    this.aliasMap[type] = {}
    this.dataMap[type] = {}
    
    const config = this.typeMap[type]
    
    // 1. 加载系统别名
    if (config.sys && fs.existsSync(config.sys)) {
      try {
        const sysData = JSON.parse(fs.readFileSync(config.sys, "utf-8"))
        this.mergeData(type, sysData)
      } catch (e) {
        logger.error(`[ams] 加载系统别名失败 ${config.sys}: ${e.message}`)
      }
    }

    // 2. 加载自定义别名
    if (fs.existsSync(config.custom)) {
      try {
        const customData = JSON.parse(fs.readFileSync(config.custom, "utf-8"))
        this.mergeData(type, customData)
      } catch (e) {
        logger.error(`[ams] 加载自定义别名失败 ${config.custom}: ${e.message}`)
      }
    }
  }

  mergeData(type, data) {
    for (const [realName, aliases] of Object.entries(data)) {
      if (!Array.isArray(aliases)) continue
      
      // 初始化 dataMap
      if (!this.dataMap[type][realName]) {
        this.dataMap[type][realName] = new Set()
      }
      
      // 添加到 aliasMap 和 dataMap
      aliases.forEach(alias => {
        const cleanAlias = String(alias).trim()
        if (!cleanAlias) return
        
        this.aliasMap[type][cleanAlias] = realName
        this.dataMap[type][realName].add(cleanAlias)
      })
      
      // 同时也把 realName 本身作为 key
      this.aliasMap[type][realName] = realName
    }
  }

  /**
   * 获取真实名称
   * @param {string} name 别名或原名
   * @param {string} type 类型 (role, weapon, echo) 默认为 role
   */
  getRealName(name, type = "role") {
    if (!name) return null
    name = String(name).trim()
    return this.aliasMap[type]?.[name] || name
  }

  /**
   * 添加别名
   * @param {string} realName 真实名称
   * @param {string} alias 新别名
   * @param {string} type 类型
   */
  async addAlias(realName, alias, type = "role") {
    // 尝试解析真实名称（可能输入的是别名）
    const resolved = this.getRealName(realName, type)
    if (resolved) {
        realName = resolved
    }

    // 如果该条目不存在于 dataMap 中，则初始化它
    // 注意：调用此方法前，调用者应确保 realName 是有效的（例如通过 DataLoader 检查）
    if (!this.dataMap[type][realName]) {
        this.dataMap[type][realName] = new Set()
        this.aliasMap[type][realName] = realName
    }

    // 检查别名是否已存在
    if (this.aliasMap[type][alias]) {
      const existReal = this.aliasMap[type][alias]
      return { success: false, msg: `❌ 别名 ${alias} 已存在，指向：${existReal}` }
    }

    // 写入文件
    const config = this.typeMap[type]
    const dir = path.dirname(config.custom)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    let customData = {}
    if (fs.existsSync(config.custom)) {
      try {
        customData = JSON.parse(fs.readFileSync(config.custom, "utf-8"))
      } catch (e) {}
    }

    if (!customData[realName]) customData[realName] = []
    if (!customData[realName].includes(alias)) {
      customData[realName].push(alias)
    }

    fs.writeFileSync(config.custom, JSON.stringify(customData, null, 2))

    // 重新加载
    this.loadType(type)
    return { success: true, msg: `✅ 已添加别名：${alias} -> ${realName}` }
  }

  /**
   * 删除别名
   * @param {string} alias 别名
   * @param {string} type 类型
   */
  async delAlias(alias, type = "role") {
    const realName = this.aliasMap[type][alias]
    if (!realName) {
      return { success: false, msg: `❌ 未找到别名：${alias}` }
    }

    // 只能删除自定义别名
    const config = this.typeMap[type]
    if (!fs.existsSync(config.custom)) {
      return { success: false, msg: `❌ 无法删除系统别名或别名不存在` }
    }

    let customData = {}
    try {
      customData = JSON.parse(fs.readFileSync(config.custom, "utf-8"))
    } catch (e) {
      return { success: false, msg: `❌ 读取自定义别名文件失败` }
    }

    let found = false
    // 遍历所有角色，查找并删除该别名
    for (const rName in customData) {
      const idx = customData[rName].indexOf(alias)
      if (idx !== -1) {
        customData[rName].splice(idx, 1)
        // 如果数组空了，可以清理key，也可以保留
        if (customData[rName].length === 0) {
            delete customData[rName]
        }
        found = true
        break
      }
    }

    if (!found) {
      return { success: false, msg: `❌ 该别名可能是系统预设，无法删除` }
    }

    fs.writeFileSync(config.custom, JSON.stringify(customData, null, 2))
    
    // 重新加载
    this.loadType(type)
    return { success: true, msg: `✅ 已删除别名：${alias}` }
  }

  /**
   * 获取某角色的所有别名
   */
  getAliases(name, type = "role") {
    const realName = this.getRealName(name, type)
    if (!realName || !this.dataMap[type][realName]) {
        return null
    }
    return Array.from(this.dataMap[type][realName])
  }
}

export default new AliasManager()
