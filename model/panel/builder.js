import DataLoader from "../../lib/core/data_loader.js"
import { Calculator } from "../../resources/waves-res/calc/Calculator.js"
import { STAT_MAP } from "../../resources/waves-res/calc/Stats.js"

import {
  ELE_ID_MAP,
  isSubPropMax,
  ROLE_ATTRIBUTE_LIST_ORDER,
  SKILL_ID_MAP,
  SKILL_ORDER,
} from "./const.js"

/**
 * 面板数据构建器 - 基于 RoleCard 构建模板所需的完整面板数据
 */
export class PanelBuilder {
  /**
   * @param {RoleCard} roleCard - 标准化的角色卡片数据
   */
  constructor(roleCard) {
    this.roleCard = roleCard
    this.resources = null
    this.panelData = null
    this._build()
  }

  /**
   * 获取构建好的面板数据
   * @returns {Object|null} 模板渲染所需的完整面板数据
   */
  get() {
    return this.panelData
  }

  /**
   * 构建面板数据
   * @private
   */
  _build() {
    if (!this.roleCard) {
      this.panelData = null
      return
    }

    try {
      this._loadResources()
      if (!this.resources.characterInfo) {
        logger.debug(`[ams] 角色基础信息加载失败: ${this.roleCard.role.id}`)
        this.panelData = null
        return
      }

      // 计算站街属性
      const calculatedStats = Calculator.calculateStreetStats(this.roleCard)

      logger.debug(
        `[ams] 计算站街属性: ${JSON.stringify(calculatedStats.getHistory(), null, 2)}`,
      )

      this.panelData = {
        ...this._buildBasicInfo(),
        ...this._buildCharacterData(),
        weapon: this._buildWeaponData(),
        ...this._buildPhantomData(),
        roleAttributeList: this._formatCalculatedAttributes(calculatedStats),
        updateTime: new Date().toLocaleString("zh-CN"),
        dataSource: "库街区API",
      }
    } catch (error) {
      logger.debug(`[ams] 构建面板数据失败: ${error.message}`)
      logger.debug(error.stack)
      this.panelData = null
    }
  }

  _loadResources() {
    const charId = this.roleCard.role.id
    const weaponId = this.roleCard.weapon.id

    // 通过 DataLoader 统一承接资源加载
    this.resources = {
      characterInfo: DataLoader.getCharacterById(charId),
      characterDetail: DataLoader.loadCharacterDetail(charId),
      weaponInfo: DataLoader.getWeaponById(weaponId),
      weaponDetail: DataLoader.loadWeaponDetail(weaponId),
    }
  }

  _buildBasicInfo() {
    const { characterInfo } = this.resources
    return {
      charId: this.roleCard.role.id,
      name: characterInfo.name,
      level: this.roleCard.role.level,
      attributeId: characterInfo.element,
      attributeName: ELE_ID_MAP[characterInfo.element],
      chainUnlockNum: this.roleCard.chains.filter(c => c.unlock).length,
    }
  }

  _buildCharacterData() {
    return {
      skillList: this._buildSkills(),
      chainList: this._buildChains(),
    }
  }

  /**
   * 格式化计算出的属性为面板展示格式
   */
  _formatCalculatedAttributes(stats) {
    const { characterInfo } = this.resources
    const elementName = ELE_ID_MAP[characterInfo.element]
    const elementDmgKey = `${elementName}伤害加成`

    return ROLE_ATTRIBUTE_LIST_ORDER.map(attrName => {
      const name = attrName.includes("{element}") ? elementDmgKey : attrName

      // 在 STAT_MAP 中查找到对应的 StatType
      const type = STAT_MAP[name]
      let value = 0
      if (type) {
        value = stats.getStatValue(type)
      }

      // 格式化输出
      const isPercent =
        name.includes("%") ||
        name.includes("加成") ||
        name.includes("效率") ||
        name.includes("暴击") ||
        name.includes("伤害提升")

      let formatValue = ""
      if (isPercent) {
        // 百分比属性
        formatValue = `${(value * 100).toFixed(1)}%`
      } else {
        // 数值属性
        formatValue = Math.floor(value).toString()
      }

      return { name, value: formatValue }
    })
  }

  _buildSkills() {
    const { characterDetail } = this.resources
    if (!this.roleCard.skills || !characterDetail?.skills) return []

    const skillMap = {}
    this.roleCard.skills.forEach((skill, index) => {
      skillMap[skill.type] = {
        id: SKILL_ID_MAP[skill.type],
        type: skill.type,
        name: characterDetail.skills[index]?.name || skill.type,
        level: skill.level,
      }
    })

    return SKILL_ORDER.filter(type => skillMap[type])
      .map(type => skillMap[type])
      .slice(0, 5)
  }

  _buildChains() {
    const { characterDetail } = this.resources
    if (!this.roleCard.chains || !characterDetail?.chains) return []

    return this.roleCard.chains.map((chain, index) => ({
      id: chain.id,
      name: characterDetail.chains[index]?.name || `共鸣链${chain.id}`,
      unlocked: chain.unlock,
    }))
  }

  _buildWeaponData() {
    const { weaponInfo, weaponDetail } = this.resources
    if (!weaponInfo) return null

    return {
      id: this.roleCard.weapon.id,
      name: weaponInfo.name,
      level: this.roleCard.weapon.level,
      resonLevel: this.roleCard.weapon.reson,
      rarity: weaponInfo.rarity,
      mainPropList: this._buildWeaponAttributes(),
      effect: this._buildWeaponEffect(),
    }
  }

  _buildWeaponAttributes() {
    const { weaponDetail } = this.resources
    if (!weaponDetail?.stats) return []

    try {
      const { weapon } = this.roleCard
      const breachStats = weaponDetail.stats[weapon.breach]
      if (!breachStats?.[weapon.level]) {
        return []
      }

      return breachStats[weapon.level].map(stat => ({
        attributeName: stat.name,
        attributeValue: this._formatWeaponStat(stat),
      }))
    } catch (error) {
      return []
    }
  }

  _buildWeaponEffect() {
    const { weaponDetail } = this.resources
    if (!weaponDetail?.skill) return ""

    const { description, params } = weaponDetail.skill
    if (!description || !params) return ""

    const { weapon } = this.roleCard
    const resonIndex = weapon.reson - 1
    let effect = description

    params.forEach((paramArray, index) => {
      const value = paramArray[resonIndex] ?? paramArray[0] ?? ""
      effect = effect.replace(`{${index}}`, value)
    })

    return effect
  }

  _formatWeaponStat(stat) {
    if (stat.is_percent) {
      return `${(stat.value / 100).toFixed(1)}%`
    }
    if (stat.is_ratio) {
      return `${(stat.value * 100).toFixed(1)}%`
    }
    return `${parseInt(stat.value)}`
  }

  _buildPhantomData() {
    return {
      equipPhantomList: this._buildPhantomList(),
    }
  }

  _buildPhantomList() {
    if (!this.roleCard.phantoms) return []

    return this.roleCard.phantoms.map(phantom => {
      const echoInfo = DataLoader.getEchoById(phantom.id)

      return {
        id: phantom.id,
        groupId: phantom.groupId,
        name: echoInfo?.name || "未知声骸",
        level: phantom.level,
        cost: phantom.cost,
        quality: phantom.quality,
        mainPropList: phantom.mainProps.map(prop => ({
          attributeName: prop.name,
          attributeValue: prop.value,
        })),
        subPropList: phantom.subProps.map(prop => ({
          attributeName: prop.name,
          attributeValue: prop.value,
          isMax: isSubPropMax(prop.name, prop.value),
        })),
      }
    })
  }
}
