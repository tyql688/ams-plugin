import { ROVER_ID } from "#waves.core"
import _ from "lodash"
import path from "path"
import DataLoader from "../lib/core/data_loader.js"
import { RolePanel, User } from "../lib/db/index.js"
import { customBgPath, customPilePath, resourcePath, wavesResMap } from "../lib/path.js"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"
import { randomFiles } from "../lib/utils.js"
import { PanelBuilder } from "../model/panel/builder.js"
import { ELE_NAME_MAP } from "../model/panel/const.js"
import { Waves2RoleCard } from "../model/roleCard.js"

// 漂泊者(主角)通用别名：库街区角色数据未收录这些泛称，写死兜底
const ROVER_ALIASES = ["主角", "漂泊者", "男主", "女主"]

export class Card extends AmsPlugin {
  constructor() {
    super({
      name: "ams-角色面板",
      event: "message",
      priority: _.get(config.getConfig("priority"), "card", 110),
      rule: [
        {
          reg: config.fixCommond("(.+)面板"),
          fnc: "characterPanel",
        },
        {
          reg: config.fixCommond("(刷新面板|面板|角色面板)$"),
          fnc: "roleList",
        },
      ],
    })
  }

  async roleList(e) {
    const wavesApi = await this.getWavesApi()
    if (!wavesApi) return

    const res = await wavesApi.getRoleData()
    if (!res?.status) return e.reply(`❌ 获取失败：${res?.msg || "接口请求错误"}`)

    const roleList = res.data.roleList || []

    roleList.sort((a, b) => {
      if (b.starLevel !== a.starLevel) return b.starLevel - a.starLevel
      if (b.starLevel === 5) {
        const aRover = ROVER_ID.includes(a.roleId) ? 1 : 0
        const bRover = ROVER_ID.includes(b.roleId) ? 1 : 0
        if (aRover !== bRover) return aRover - bRover
      }
      if (b.level !== a.level) return b.level - a.level
      const chainA = a.chainUnlockNum || 0
      const chainB = b.chainUnlockNum || 0
      if (chainB !== chainA) return chainB - chainA
      return b.roleId - a.roleId
    })

    if (wavesApi.dbUser) {
      const gameData = wavesApi.dbUser.gameData || {}
      gameData.roleList = roleList.map(r => r.roleId)
      await User.updateSilent(
        wavesApi.dbUser.userId,
        wavesApi.dbUser.gameUid,
        wavesApi.dbUser.gameId,
        { gameData },
      )
    }

    // 获取头像
    await this.getAvatarUrl()

    const img = await this.render("character/role-list", {
      roles: roleList,
      uid: wavesApi.wavesId,
      roleName: wavesApi.dbUser?.gameData?.roleName,
      command: config.exampleCommond("角色名面板"),
    })
    return img ? e.reply(img) : e.reply("❌ 绘图失败")
  }

  /**
   * 获取自定义素材
   */
  getCustomAssets(charId) {
    let res = {
      customBg: randomFiles(customBgPath),
      customPile: randomFiles(path.join(customPilePath, String(charId))),
    }
    return res
  }

  async characterPanel(e) {
    const regex = new RegExp(config.fixCommond("(.+)面板"))
    const match = e.msg.match(regex)
    const inputName = match?.[1]?.trim()
    if (!inputName) return e.reply(`请输入角色名称，如：${config.exampleCommond("长离面板")}`)

    const wavesApi = await this.getWavesApi()
    if (!wavesApi) return

    let roleId = Number(await DataLoader.getRoleId(inputName))
    // 主角泛称兜底：命中任一主角id即可，下方会重映射到持有的那个形态
    if (!roleId && ROVER_ALIASES.includes(inputName)) roleId = ROVER_ID[0]
    if (!roleId) return e.reply(`❌ 未找到角色ID: ${inputName}`)

    // 检查是否持有该角色
    const ownedRoles = wavesApi.dbUser?.gameData?.roleList || []
    const isRover = ROVER_ID.includes(roleId)
    const isOwned = isRover
      ? ROVER_ID.some(id => ownedRoles.includes(id))
      : ownedRoles.includes(roleId)

    if (!isOwned) {
      return e.reply(`请先发送 "${config.exampleCommond("面板")}" 后使用本功能查看角色详细面板`)
    }

    // 主角(漂泊者)只有一个形态：用户实际持有的那个。无论输入哪个属性名，
    // 都改用持有的主角id去请求，避免请求未持有的形态导致接口返回空数据
    if (isRover) {
      roleId = ownedRoles.find(id => ROVER_ID.includes(id)) || roleId
    }

    let detail
    let dataTime
    let fromCache = false

    const apiResponse = await wavesApi.getRoleDetail(roleId)
    // 接口需 status 成功且含 role 明细才算有效（未持有的主角形态会返回空数据）
    if (apiResponse?.status && apiResponse.data?.role) {
      detail = apiResponse.data
      dataTime = new Date()
      // 落库（不阻塞渲染）
      RolePanel.save(wavesApi.wavesId, roleId, detail).catch(err =>
        logger.error(`[ams] 保存角色面板失败: ${err.message}`),
      )
    } else {
      // 实时获取失败/无效，回退数据库缓存（主角按任一形态匹配）
      const cached = await RolePanel.get(wavesApi.wavesId, roleId).catch(() => null)
      if (!cached?.detail) {
        return e.reply(`❌ 获取角色数据失败: ${apiResponse?.msg || "暂无该角色面板数据"}`)
      }
      detail = cached.detail
      dataTime = cached.updatedAt
      fromCache = true
      logger.mark(`[ams] 角色面板回退数据库缓存: ${wavesApi.wavesId}/${roleId}`)
    }

    const roleCard = new Waves2RoleCard(detail).toRoleCard()
    logger.debug(`[ams] roleCard: ${JSON.stringify(roleCard)}`)
    const panelData = new PanelBuilder(roleCard).get()
    if (!panelData) return e.reply("❌ 面板数据构建失败")

    // 更新时间显示数据实际刷新时间；命中缓存时标注来源
    panelData.updateTime = dataTime.toLocaleString("zh-CN")
    if (fromCache) panelData.dataSource = "数据库缓存"

    const { customBg, customPile } = this.getCustomAssets(roleId)

    const img = await this.render("character/profile-detail", {
      data: panelData,
      uid: wavesApi.wavesId,
      elem: ELE_NAME_MAP[panelData.attributeId],
      customBg,
      customPile,
    })
    const res = await (img ? e.reply(img) : e.reply("❌ 面板绘图失败"))
    if (res && res.message_id) {
      const messageIds = Array.isArray(res.message_id) ? res.message_id : [res.message_id]
      for (const msgId of messageIds) {
        // 存储立绘：优先自定义，否则存储默认
        const pilePath =
          customPile ||
          `file://${path.join(wavesResMap.rolePile, `${roleId}.webp`).replace(/\\/g, "/")}`
        await redis.set(`ams:original-picture:${msgId}`, pilePath, { EX: 3600 * 3 })

        // 存储背景：优先自定义，否则存储默认
        const bgPath =
          customBg ||
          `file://${path.join(resourcePath, "common", "bg", "bg.png").replace(/\\/g, "/")}`
        await redis.set(`ams:original-background:${msgId}`, bgPath, { EX: 3600 * 3 })
      }
    }
    return true
  }
}
