import _ from "lodash"
import AliasManager from "../lib/alias_manager.js"
import DataLoader from "../lib/core/data_loader.js"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"

export class AliasApp extends AmsPlugin {
  constructor() {
    super({
      name: "ams-别名",
      event: "message",
      priority: _.get(config.getConfig("priority"), "alias", 110),
      rule: [
        {
          reg: config.fixCommond("添加(角色|武器|声骸)?别名.*"),
          fnc: "addAlias",
          permission: "master",
        },
        {
          reg: config.fixCommond("删除(角色|武器|声骸)?别名.*"),
          fnc: "delAlias",
          permission: "master",
        },
        {
          reg: config.fixCommond("(角色|武器|声骸)?别名列表.*"),
          fnc: "listAlias",
        },
      ],
    })
  }

  async addAlias(e) {
    let regStr = config.fixCommond("添加(角色|武器|声骸)?别名")
    regStr = regStr.replace(/\$$/, "")
    const reg = new RegExp(regStr)

    const match = e.msg.match(reg)
    const typeStr = match ? match[1] : null

    const msg = e.msg.replace(reg, "").trim()
    const parts = msg.split(/\s+/)

    if (parts.length < 2) {
      await e.reply(`❌ 格式错误\n请使用：${config.exampleCommond("添加别名 长离 离离")}`)
      return
    }

    const realName = parts[0]
    const alias = parts[1]

    // 确定类型
    let type = null
    if (typeStr === "角色") type = "role"
    else if (typeStr === "武器") type = "weapon"
    else if (typeStr === "声骸") type = "echo"

    // 如果未指定类型，尝试自动推断
    if (!type) {
      if (DataLoader.getRoleId(realName)) type = "role"
      else if (DataLoader.getWeaponId(realName)) type = "weapon"
      else if (DataLoader.getEchoId(realName)) type = "echo"
    }

    if (!type) {
      await e.reply(
        `❌ 未找到名称：${realName}\n请确认名称正确，或显式指定类型（如：添加武器别名）`,
      )
      return
    }

    const res = await AliasManager.addAlias(realName, alias, type)
    await e.reply(res.msg)
  }

  async delAlias(e) {
    let regStr = config.fixCommond("删除(角色|武器|声骸)?别名")
    regStr = regStr.replace(/\$$/, "")
    const reg = new RegExp(regStr)

    const match = e.msg.match(reg)
    const typeStr = match ? match[1] : null
    const alias = e.msg.replace(reg, "").trim()

    if (!alias) {
      await e.reply(`❌ 请输入要删除的别名`)
      return
    }

    let typesToCheck = []
    if (typeStr === "角色") typesToCheck = ["role"]
    else if (typeStr === "武器") typesToCheck = ["weapon"]
    else if (typeStr === "声骸") typesToCheck = ["echo"]
    else typesToCheck = ["role", "weapon", "echo"]

    let deleted = false
    let msgs = []

    for (const type of typesToCheck) {
      // 检查该别名是否存在于该类型中 (只检查自定义别名，addAlias/delAlias 只操作自定义)
      // 但 delAlias 会检查是否存在。
      // 我们直接调用 delAlias，它会返回结果。
      // 但是 AliasManager.delAlias 如果找不到会返回错误。
      // 我们需要先检查是否存在，避免报错刷屏。
      // AliasManager 没有 public exist check (except aliasMap).
      // 我们可以直接调 delAlias，如果成功则标记。

      // 简单优化：先检查 aliasMap
      if (AliasManager.aliasMap[type][alias]) {
        const res = await AliasManager.delAlias(alias, type)
        if (res.success) {
          msgs.push(`[${AliasManager.typeMap[type].name}] ${res.msg}`)
          deleted = true
        } else {
          // 可能是系统别名无法删除，也记录
          if (res.msg.includes("系统别名")) {
            msgs.push(`[${AliasManager.typeMap[type].name}] ${res.msg}`)
          }
        }
      }
    }

    if (!deleted && msgs.length === 0) {
      await e.reply(`❌ 未找到别名：${alias}`)
    } else if (msgs.length > 0) {
      await e.reply(msgs.join("\n"))
    }
  }

  async listAlias(e) {
    let regStr = config.fixCommond("(角色|武器|声骸)?别名列表")
    regStr = regStr.replace(/\$$/, "")
    const reg = new RegExp(regStr)

    const match = e.msg.match(reg)
    const typeStr = match ? match[1] : null
    const name = e.msg.replace(reg, "").trim()

    if (!name) {
      await e.reply(`❌ 请输入名称`)
      return
    }

    let typesToCheck = []
    if (typeStr === "角色") typesToCheck = ["role"]
    else if (typeStr === "武器") typesToCheck = ["weapon"]
    else if (typeStr === "声骸") typesToCheck = ["echo"]
    else typesToCheck = ["role", "weapon", "echo"]

    let found = false
    let msgs = []

    for (const type of typesToCheck) {
      const realName = AliasManager.getRealName(name, type)
      // 只有当解析出真实名字，且该名字有别名时才显示
      // 但 getRealName 默认返回原名。需检查是否有数据。
      // getAliases 会检查 dataMap
      const aliases = AliasManager.getAliases(realName, type)
      if (aliases && aliases.length > 0) {
        const typeName = AliasManager.typeMap[type].name
        msgs.push(`📋 [${typeName}] ${realName}：${aliases.join("、")}`)
        found = true
      }
    }

    if (!found) {
      await e.reply(`❌ 未找到别名数据：${name}`)
    } else {
      await e.reply(msgs.join("\n"))
    }
  }
}
