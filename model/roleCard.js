/**
 * @typedef {Object} Role
 * @property {number} id - 角色id
 * @property {number} level - 等级
 * @property {number} breach - 突破阶级
 */

/**
 * @typedef {Object} Weapon
 * @property {number} id - 武器id
 * @property {number} reson - 谐振阶级
 * @property {number} level - 等级
 * @property {number} breach - 突破阶级
 */

/**
 * @typedef {Object} Chain
 * @property {number} id - 链条id
 * @property {boolean} unlock - 是否解锁
 */

/**
 * @typedef {Object} Skill
 * @property {number} level - 等级
 * @property {("常态攻击"|"共鸣技能"|"共鸣回路"|"共鸣解放"|"变奏技能"|"延奏技能"|"谐度破坏")} type - 类型
 */

/**
 * @typedef {Object} Props
 * @property {string} name - 属性名称
 * @property {string} value - 属性值
 */

/**
 * @typedef {Object} Phantom
 * @property {number} id - 声骸id
 * @property {number} groupId - 套装id
 * @property {number} cost - 消耗
 * @property {number} quality - 质量 [1-5]
 * @property {number} level - 等级
 * @property {Props[]} mainProp - 主属性
 * @property {Props[]} subProps - 副属性
 */

/**
 * @typedef {Object} RoleCard
 * @property {Role} role
 * @property {Weapon} weapon
 * @property {Chain[]} chains
 * @property {Skill[]} skills
 * @property {Phantom[]} phantoms
 */

class Waves2RoleCard {
  constructor(rawData) {
    this.rawData = rawData
  }

  /**
   * 转换为 RoleCard 格式
   * @returns {RoleCard}
   */
  toRoleCard() {
    return {
      role: this._convertRole(),
      weapon: this._convertWeapon(),
      chains: this._convertChains(),
      skills: this._convertSkills(),
      phantoms: this._convertPhantoms(),
    }
  }

  /**
   * 转换角色数据
   * @returns {Role}
   */
  _convertRole() {
    const { role } = this.rawData
    return {
      id: role.roleId,
      level: role.level,
      breach: role.breach,
    }
  }

  /**
   * 转换武器数据
   * @returns {Weapon}
   */
  _convertWeapon() {
    const { weaponData } = this.rawData
    return {
      id: weaponData.weapon.weaponId,
      reson: weaponData.resonLevel,
      level: weaponData.level,
      breach: weaponData.breach,
    }
  }

  /**
   * 转换命座数据
   * @returns {Chain[]}
   */
  _convertChains() {
    const { chainList } = this.rawData
    return chainList.map(chain => ({
      id: chain.order,
      unlock: chain.unlocked,
    }))
  }

  /**
   * 转换技能数据
   * @returns {Skill[]}
   */
  _convertSkills() {
    const { skillList } = this.rawData
    return skillList.map(skillItem => ({
      level: skillItem.level,
      type: skillItem.skill.type,
    }))
  }

  /**
   * 转换声骸数据
   * @returns {Phantom[]}
   */
  _convertPhantoms() {
    const { phantomData } = this.rawData
    if (!phantomData || !phantomData.equipPhantomList) {
      return []
    }

    return phantomData.equipPhantomList
      .filter(phantom => phantom && phantom.phantomProp)
      .map(phantom => ({
        id: phantom.phantomProp.phantomId,
        groupId: phantom.fetterDetail.groupId,
        cost: phantom.cost,
        quality: phantom.quality,
        level: phantom.level,
        mainProps: this._convertProps(phantom.mainProps),
        subProps: this._convertProps(phantom.subProps),
      }))
  }

  /**
   * 转换声骸属性
   * @param {Array} props
   * @returns {Props[]}
   */
  _convertProps(props) {
    if (!props) return []
    return props.map(prop => ({
      name: prop.attributeName,
      value: prop.attributeValue,
    }))
  }
}

export { Waves2RoleCard }
