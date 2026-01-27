import _ from "lodash"
import DataLoader from "../lib/core/data_loader.js"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"
import {
  ELE_ID_MAP,
  ELE_NAME_MAP,
  WEAPON_TYPE_ID_MAP,
} from "../resources/waves-res/core/constants.js"

export class Wiki extends AmsPlugin {
  constructor() {
    super({
      name: "ams-角色图鉴",
      event: "message",
      priority: _.get(config.getConfig("priority"), "wiki", 110),
      rule: [
        {
          reg: config.fixCommond("(.+)(天赋|技能)$"),
          fnc: "showTalent",
        },
        {
          reg: config.fixCommond("(.+)(共鸣链|命座)$"),
          fnc: "showChain",
        },
        {
          // Unified Wiki Command: Matches "Name + (Optional Type) + 图鉴"
          // e.g. "千嶂武器图鉴", "无妄者声骸图鉴"
          reg: config.fixCommond("(.+?)(武器|声骸)?图鉴$"),
          fnc: "showWiki",
        },
        {
          reg: config.fixCommond("(角色|武器|声骸)列表$"),
          fnc: "wikiList",
        },
      ],
    })
  }

  async showTalent(e) {
    try {
      const match = e.msg.match(this.rule[0].reg)
      const charName = match && match[1] ? match[1].trim() : ""

      if (!charName) {
        return e.reply(`请输入角色名称，如：${config.exampleCommond("长离天赋")}`)
      }

      const roleId = await DataLoader.getRoleId(charName)
      if (!roleId) {
        return e.reply(`❌ 未找到角色：${charName}`)
      }

      const roleData = DataLoader.loadCharacterDetail(roleId)
      if (!roleData) {
        return e.reply(`❌ 获取角色数据失败`)
      }

      const renderData = {
        mode: "talent",
        modeTitle: "技能天赋",
        name: roleData.name || charName,
        roleId: roleId,
        element: roleData.element,
        elemName: ELE_NAME_MAP[roleData.element],
        talents: this._formatTalents(roleData),
      }

      const img = await this.render("wikis/wiki-role", renderData)
      if (img) {
        return e.reply(img)
      } else {
        return e.reply("❌ 绘图失败")
      }
    } catch (error) {
      logger.error(`[ams] showTalent: ${error}`)
      return e.reply("❌ 查询技能天赋失败")
    }
  }

  async showChain(e) {
    try {
      const match = e.msg.match(this.rule[1].reg)
      const charName = match && match[1] ? match[1].trim() : ""

      if (!charName) {
        return e.reply(`请输入角色名称，如：${config.exampleCommond("长离共鸣链")}`)
      }

      const roleId = await DataLoader.getRoleId(charName)
      if (!roleId) {
        return e.reply(`❌ 未找到角色：${charName}`)
      }

      const roleData = DataLoader.loadCharacterDetail(roleId)
      if (!roleData) {
        return e.reply(`❌ 获取角色数据失败`)
      }

      const renderData = {
        mode: "chain",
        modeTitle: "共鸣链",
        name: roleData.name || charName,
        roleId: roleId,
        element: roleData.element,
        elemName: ELE_NAME_MAP[roleData.element],
        chains: this._formatChains(roleData),
      }

      const img = await this.render("wikis/wiki-role", renderData)
      if (img) {
        return e.reply(img)
      } else {
        return e.reply("❌ 绘图失败")
      }
    } catch (error) {
      logger.error(`[ams] showChain: ${error}`)
      return e.reply("❌ 查询共鸣链失败")
    }
  }

  async showWiki(e) {
    const match = e.msg.match(this.rule[2].reg)
    if (!match) return false

    const name = match[1] ? match[1].trim() : ""
    const type = match[2] // "武器" or "声骸" or undefined

    if (!name) return e.reply("请输入名称")

    let id = null
    let mode = null // "weapon" or "echo"

    // 1. Explicit Type
    if (type === "武器") {
      id = await DataLoader.getWeaponId(name)
      if (id) mode = "weapon"
    } else if (type === "声骸") {
      id = await DataLoader.getEchoId(name)
      if (id) mode = "echo"
    } else {
      // 2. Auto Detect (Priority: Weapon > Echo)
      id = await DataLoader.getWeaponId(name)
      if (id) {
        mode = "weapon"
      } else {
        id = await DataLoader.getEchoId(name)
        if (id) mode = "echo"
      }
    }

    if (!id || !mode) {
      return e.reply(`❌ 未找到${type || "相关"}数据：${name}`)
    }

    if (mode === "weapon") {
      return await this._renderWeapon(e, id)
    } else {
      return await this._renderEcho(e, id)
    }
  }

  async wikiList(e) {
    const match = e.msg.match(this.rule[3].reg)
    const type = match[1]

    let list = []
    let title = ""
    let mode = ""

    if (type === "角色") {
      list = DataLoader.loadCharacters()
      title = "角色图鉴列表"
      mode = "role"
    } else if (type === "武器") {
      list = DataLoader.loadWeapons()
      title = "武器图鉴列表"
      mode = "weapon"
    } else if (type === "声骸") {
      list = DataLoader.loadEchoes()
      title = "声骸图鉴列表"
      mode = "echo"
    }

    // 5. 分组逻辑
    let groups = []
    if (mode === "role") {
      const grouped = _.groupBy(list, "element")
      // 按 ID 排序属性
      Object.keys(ELE_ID_MAP).forEach(key => {
        const items = grouped[key]
        if (items && items.length > 0) {
          groups.push({
            label: ELE_ID_MAP[key],
            theme: "element-" + key,
            list: items
              .sort((a, b) => b.rarity - a.rarity || a.id - b.id)
              .map(item => ({
                ...item,
              })),
          })
        }
      })
    } else if (mode === "weapon") {
      const grouped = _.groupBy(list, "type")
      Object.keys(WEAPON_TYPE_ID_MAP).forEach(key => {
        const items = grouped[key]
        if (items && items.length > 0) {
          groups.push({
            label: WEAPON_TYPE_ID_MAP[key],
            theme: "weapon-" + key,
            list: items
              .sort((a, b) => b.rarity - a.rarity || a.id - b.id)
              .map(item => ({
                ...item,
              })),
          })
        }
      })
    } else if (mode === "echo") {
      const grouped = _.groupBy(list, "cost")
      const costs = Object.keys(grouped).sort((a, b) => b - a)
      costs.forEach(cost => {
        groups.push({
          label: `Cost ${cost}`,
          list: grouped[cost]
            .sort((a, b) => a.id - b.id)
            .map(item => ({
              ...item,
              rarity: item.cost == 4 ? 5 : item.cost == 3 ? 4 : 3,
            })),
        })
      })
    }

    const renderData = {
      title,
      mode,
      groups,
      count: list.length,
    }

    const img = await this.render("wikis/wiki-list", renderData)
    if (img) {
      return e.reply(img)
    } else {
      return e.reply("❌ 绘图失败")
    }
  }

  async _renderWeapon(e, id) {
    try {
      const data = DataLoader.loadWeaponDetail(id)
      if (!data) return e.reply("❌ 获取武器数据失败")

      // Support both 'attrs' (standard) and 'stats' (raw json sometimes) keys
      const attrs = data.stats

      const renderData = {
        name: data.name,
        id: data.id,
        rarity: data.rarity,
        type: data.type,
        desc: data.desc,
        stats: this._formatWeaponStats(attrs),
        skill: {
          name: data.skill?.name,
          desc: this._formatDesc(data.skill?.description, data.skill?.params),
          params: data.skill?.params,
        },
      }

      const img = await this.render("wikis/wiki-weapon", renderData)
      if (img) return e.reply(img)
      return e.reply("❌ 绘图失败")
    } catch (err) {
      logger.error(err)
      return e.reply("❌ 查询武器失败")
    }
  }

  async _renderEcho(e, id) {
    try {
      const data = DataLoader.loadEchoDetail(id)
      if (!data) return e.reply("❌ 获取声骸数据失败")

      // Resolve Sonatas
      let sonatas = []
      if (data.group) {
        const groups = Array.isArray(data.group) ? data.group : [data.group]
        sonatas = groups
          .map(gid => {
            const g = DataLoader.getEchoGroupById(gid)
            return g ? { id: g.id, name: g.name } : null
          })
          .filter(Boolean)
      }

      const renderData = {
        name: data.name,
        id: data.id,
        cost: data.cost,
        intensity: data.intensityCode || 0,
        sonatas: sonatas,
        skill: {
          desc: this._formatDesc(data.skill?.desc, data.skill?.params),
          params: data.skill?.params,
        },
      }

      const img = await this.render("wikis/wiki-echo", renderData)
      if (img) return e.reply(img)
      return e.reply("❌ 绘图失败")
    } catch (err) {
      logger.error(err)
      return e.reply("❌ 查询声骸失败")
    }
  }

  /**
   * 格式化天赋数据
   */
  _formatTalents(roleData) {
    const talents = []
    const skillData = roleData.skills || []

    skillData.forEach(skill => {
      if (!skill || !skill.name) return

      if (skill.type === "") return

      talents.push({
        id: skill.id,
        name: skill.name,
        type: skill.type,
        desc: this._formatDesc(skill.description || ""),
        params: this._formatParams(skill.damages || []),
      })
    })

    return talents
  }

  /**
   * 格式化共鸣链数据
   */
  _formatChains(roleData) {
    const chains = []
    const chainData = roleData.chains || []

    chainData.forEach((chain, idx) => {
      if (!chain || !chain.name) return

      chains.push({
        id: idx + 1,
        name: chain.name,
        desc: this._formatDesc(chain.description || ""),
      })
    })

    return chains
  }

  /**
   * 格式化描述文本，高亮数值，并填充参数
   */
  _formatDesc(desc, params = []) {
    if (!desc) return ""

    let formatted = desc

    // Fill placeholders {0}, {1}, etc.
    if (params && params.length > 0) {
      formatted = formatted.replace(/\{(\d+)\}/g, (match, index) => {
        const val = params[index]
        if (Array.isArray(val)) {
          // Weapon style: array of values for ranks
          // Check if all values are consistent (like "2", "2"...)
          // If all same, just show one? No, reference shows (12%/15%...)
          // But "14" seconds is "14" in all ranks. Reference shows "14" (not 14/14/14).
          // Heuristic: if all unique values are same, show one.
          const unique = [...new Set(val)]
          if (unique.length === 1) {
            return unique[0]
          }
          // Join with slash. Trim values to avoid accidental spaces from data.
          // Add spaces around slash for better readability if desired, or keep tight?
          // User asked "How did spaces appear", implying they might be unwanted or inconsistent.
          // Let's trim and use tight slash to be safe/consistent.
          return `(${val.map(v => v.toString().trim()).join("/")})`
        } else if (val !== undefined) {
          return val
        }
        return match
      })
    }

    return formatted
      .replace(/\\n/g, "<br>")
      .replace(/\n/g, "<br>")
      .replace(/(\d+\.?\d*%?)/g, "<nobr>$1</nobr>") // Highlighting
  }

  /**
   * 格式化参数表格
   * damages 格式: [{name, level, damage: [值1, 值2, ...]}]
   */
  _formatParams(damages) {
    if (!damages || damages.length === 0) return []

    return damages.map(param => ({
      name: param.name || "",
      values: param.damage || [],
    }))
  }

  _formatWeaponStats(attrs) {
    if (!attrs) return []
    // Attempt to find Level 90 stats in "6"
    let rawStats = attrs["6"]["90"]

    return rawStats.map(s => {
      let val = s.value
      // Logic from WeaponCalculator.ts
      if (s.is_ratio) {
        // val = val
      } else if (s.is_percent) {
        val = val / 10000.0
      }

      let displayVal
      let isPercent =
        s.is_ratio ||
        s.is_percent ||
        s.name.includes("加成") ||
        s.name.includes("效率") ||
        s.name.includes("暴击") ||
        s.name.includes("伤害")

      if (isPercent) {
        displayVal = (val * 100).toFixed(1) + "%"
      } else {
        displayVal = Math.round(val)
      }
      return { name: s.name, value: displayVal }
    })
  }
}
