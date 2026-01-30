import _ from "lodash"
import DataLoader from "../lib/core/data_loader.js"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"

// 技能顺序：常态攻击, 共鸣技能, 共鸣解放, 变奏技能, 共鸣回路
const SKILL_ORDER = ["常态攻击", "共鸣技能", "共鸣解放", "变奏技能", "共鸣回路"]
const SKILL_BREAK_LIST = ["2-1", "2-2", "2-3", "2-4", "2-5", "3-1", "3-2", "3-3", "3-4", "3-5"]

export class Develop extends AmsPlugin {
  constructor() {
    super({
      name: "ams-养成计算",
      event: "message",
      priority: _.get(config.getConfig("priority"), "develop", 110),
      rule: [
        {
          reg: config.fixCommond("(.+)养成$"),
          fnc: "calcDevelop",
        },
      ],
    })
  }

  async calcDevelop(e) {
    const match = e.msg.match(config.fixCommond("(.+)养成$"))
    if (!match) return false

    const developListStr = match[1]?.trim()
    if (!developListStr) return false

    const developList = developListStr.split(/\s+/).filter(Boolean)
    // 默认全部等级拉满 (10级)
    const targetSkillLevels = [10, 10, 10, 10, 10]

    if (developList.length === 0) return false
    if (developList.length > 2) return e.reply("❌ 暂不支持查询两个以上角色养成")

    const wavesApi = await this.getWavesApi()
    if (!wavesApi) return

    // 1. 刷新计算器数据
    await wavesApi.calculatorRefresh()

    // 2. 获取在线角色和武器列表
    const [onlineRoleRes, onlineWeaponRes] = await Promise.all([
      wavesApi.getOnlineListRole(),
      wavesApi.getOnlineListWeapon(),
    ])

    if (!onlineRoleRes.status || !onlineWeaponRes.status) {
      return e.reply("❌ 获取养成配置失败")
    }

    const onlineRoleMap = _.keyBy(onlineRoleRes.data, "roleId")
    const onlineWeaponMap = _.keyBy(onlineWeaponRes.data, "weaponId")

    // 3. 获取拥有的角色 ID
    const ownedRoleRes = await wavesApi.getOwnedRoleInfo()
    if (!ownedRoleRes.status) return e.reply("❌ 获取拥有角色信息失败")
    const ownedCharIds = (ownedRoleRes.data?.roleInfoList || []).map(r => String(r.roleId))

    // 4. 解析输入的角色
    const aliasCharIds = []
    for (const name of developList) {
      const charId = await DataLoader.getRoleId(name)
      if (charId && onlineRoleMap[charId]) {
        aliasCharIds.push(String(charId))
      }
    }

    if (aliasCharIds.length === 0) return e.reply("❌ 未找到养成角色")

    // 5. 分离已拥有的和未拥有的
    const owneds = []
    const notOwneds = []
    for (const charId of aliasCharIds) {
      if (ownedCharIds.includes(charId)) {
        owneds.push(charId)
      } else {
        notOwneds.push(charId)
      }
    }

    // 6. 获取已拥有角色的当前进度
    let cultivateStatusMap = {}
    if (owneds.length > 0) {
      const cultivateRes = await wavesApi.getRoleCultivateStatus(owneds)
      if (cultivateRes.status) {
        cultivateStatusMap = _.keyBy(cultivateRes.data, "roleId")
      }
    }

    // 7. 准备 contentList
    const contentList = []
    const targetSkillLevelsMap = _.zipObject(SKILL_ORDER, targetSkillLevels)

    // 处理未拥有的角色
    for (const charId of notOwneds) {
      const charName = onlineRoleMap[charId].roleName
      const weaponId = DataLoader.getWeaponId(`${charName}专武`)

      contentList.push({
        roleId: Number(charId),
        roleStartLevel: 1,
        roleEndLevel: 90,
        skillLevelUpList: SKILL_ORDER.map(name => ({
          startLevel: 1,
          endLevel: targetSkillLevelsMap[name] || 10,
        })),
        advanceSkillList: SKILL_BREAK_LIST,
        weaponId: weaponId || undefined,
        weaponStartLevel: 1,
        weaponEndLevel: 90,
        _category: "all",
      })
    }

    // 处理已拥有的角色
    for (const charId of owneds) {
      const status = cultivateStatusMap[charId] || {}
      const skillLevelMap = _.keyBy(status.skillLevelList || [], "type")

      const charName = onlineRoleMap[charId].roleName
      const defaultWeaponId = DataLoader.getWeaponId(`${charName}专武`)

      contentList.push({
        roleId: Number(charId),
        roleStartLevel: status.roleLevel || 1,
        roleEndLevel: 90,
        skillLevelUpList: SKILL_ORDER.map(name => {
          const current = (skillLevelMap[name] || {}).level || 1
          return {
            startLevel: current,
            endLevel: Math.max(current, targetSkillLevelsMap[name] || 10),
          }
        }),
        advanceSkillList: _.difference(SKILL_BREAK_LIST, status.skillBreakList || []),
        weaponId: status.equipWeapon?.id || defaultWeaponId || undefined,
        weaponStartLevel: status.equipWeapon?.level || 1,
        weaponEndLevel: 90,
        _category: "all",
      })
    }

    // 8. 获取养成成本
    const costRes = await wavesApi.getBatchRoleCost(contentList)
    if (!costRes.status) return e.reply(`❌ 获取养成成本失败：${costRes.msg || "接口错误"}`)

    // 9. 渲染结果
    const costData = costRes.data
    const contentMap = _.keyBy(contentList, "roleId")

    // 获取头像
    await this.getAvatarUrl()

    const img = await this.render("develop/index", {
      costList: costData.costList,
      preview: costData.preview,
      contentMap,
      onlineRoleMap,
      onlineWeaponMap,
      uid: wavesApi.wavesId,
    })

    return img ? e.reply(img) : e.reply("❌ 渲染失败")
  }
}
