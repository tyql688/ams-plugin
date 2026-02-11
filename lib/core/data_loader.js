import AliasManager from "../alias_manager.js"

// Import everything from waves-res data index
import * as WavesData from "#waves.data"

const { CharacterList, WeaponList, EchoList, EchoSet, Role, Weapon, Echo } = WavesData

/**
 * 数据加载器 - 从资源文件加载基础数据
 */
class DataLoader {
  constructor() {}

  /**
   * 加载角色列表
   */
  loadCharacters() {
    try {
      const map = CharacterList.loadAll()
      return Object.values(map)
    } catch (error) {
      logger.error(`[ams] 加载角色数据失败: ${error.message}`)
      return []
    }
  }

  /**
   * 加载武器列表
   */
  loadWeapons() {
    try {
      const map = WeaponList.loadAll()
      return Object.values(map)
    } catch (error) {
      logger.error(`[ams] 加载武器数据失败: ${error.message}`)
      return []
    }
  }

  /**
   * 加载声骸列表
   */
  loadEchoes() {
    try {
      const map = EchoList.loadAll()
      return Object.values(map)
    } catch (error) {
      logger.error(`[ams] 加载声骸数据失败: ${error.message}`)
      return []
    }
  }

  /**
   * 加载声骸套装
   */
  loadEchoGroups() {
    try {
      const map = EchoSet.loadAll()
      return Object.values(map)
    } catch (error) {
      logger.error(`[ams] 加载声骸套装数据失败: ${error.message}`)
      return []
    }
  }

  /**
   * 根据ID获取角色信息
   */
  getCharacterById(id) {
    return CharacterList.get(id)
  }

  /**
   * 根据ID获取武器信息
   */
  getWeaponById(id) {
    return WeaponList.get(id)
  }

  /**
   * 根据ID获取声骸信息
   */
  getEchoById(id) {
    return EchoList.get(id)
  }

  /**
   * 根据ID获取声骸套装信息
   * 注意：EchoSet.js 中方法是 getSet(id)
   */
  getEchoGroupById(id) {
    return EchoSet.getSet(id)
  }

  /**
   * 加载角色详细数据
   */
  loadCharacterDetail(id) {
    try {
      return new Role(id).getData()
    } catch (error) {
      logger.error(`[ams] 加载角色详细数据失败 (${id}): ${error.message}`)
      return null
    }
  }

  /**
   * 加载武器详细数据
   */
  loadWeaponDetail(id) {
    try {
      return new Weapon(id).getData()
    } catch (error) {
      logger.error(`[ams] 加载武器详细数据失败 (${id}): ${error.message}`)
      return null
    }
  }

  /**
   * 加载声骸详细数据
   */
  loadEchoDetail(id) {
    try {
      return new Echo(id).getData()
    } catch (error) {
      logger.error(`[ams] 加载声骸详细数据失败 (${id}): ${error.message}`)
      return null
    }
  }

  /**
   * 根据武器名称获取武器ID
   * @param {string} inputName - 武器名称
   * @returns {number|null} 武器ID，未找到返回 null
   */
  getWeaponId(inputName) {
    // 1. 尝试别名解析
    const realName = AliasManager.getRealName(inputName, "weapon") || inputName

    // 2. 查找武器
    const weapons = this.loadWeapons()
    const weapon = weapons.find(w => w.name == realName)
    return weapon ? weapon.id : null
  }

  /**
   * 根据声骸名称获取声骸ID
   * @param {string} inputName - 声骸名称
   * @returns {number|null} 声骸ID，未找到返回 null
   */
  getEchoId(inputName) {
    // 1. 尝试别名解析
    const realName = AliasManager.getRealName(inputName, "echo") || inputName

    // 2. 查找声骸
    const echoes = this.loadEchoes()
    const echo = echoes.find(e => e.name == realName)
    return echo ? echo.id : null
  }

  /**
   * 根据角色名称获取角色ID
   * @param {string} inputName - 角色名称
   * @returns {number|null} 角色ID，未找到返回 null
   */
  getRoleId(inputName) {
    // 1. 尝试别名解析
    const realName = AliasManager.getRealName(inputName, "role") || inputName

    // 2. 查找角色
    const characters = this.loadCharacters()
    const character = characters.find(c => c.name == realName)
    return character ? character.id : null
  }
}

export default new DataLoader()
