import fs from "fs"
import _ from "lodash"
import path from "path"
import DataLoader from "../lib/core/data_loader.js"
import { User } from "../lib/db/index.js"
import { customBgPath, customPilePath, resourcePath, wavesResMap } from "../lib/path.js"
import { AmsPlugin } from "../lib/plugin.js"
import config from "../lib/settings.js"
import { PanelBuilder } from "../model/panel/builder.js"
import { ELE_NAME_MAP } from "../model/panel/const.js"
import { Waves2RoleCard } from "../model/roleCard.js"
import { ROVER_ID } from "../resources/waves-res/core/constants.js"
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

    const img = await this.render("character/role-list", {
      roles: roleList,
      uid: wavesApi.wavesId,
      command: config.exampleCommond("角色名面板"),
    })
    return img ? e.reply(img) : e.reply("❌ 绘图失败")
  }

  /**
   * 获取自定义素材
   */
  getCustomAssets(charId) {
    let res = {
      customBg: null,
      customPile: null,
    }

    // 1. 获取背景图 (从 custom/bg 随机取)
    if (fs.existsSync(customBgPath)) {
      let files = fs.readdirSync(customBgPath).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
      if (files.length > 0) {
        const randomFile = files[Math.floor(Math.random() * files.length)]
        res.customBg = `file://${path.join(customBgPath, randomFile).replace(/\\/g, "/")}`
      }
    }

    // 2. 获取立绘图 (从 custom/pile/id 随机取)
    let charPileDir = path.join(customPilePath, String(charId))
    if (fs.existsSync(charPileDir)) {
      let files = fs.readdirSync(charPileDir).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
      if (files.length > 0) {
        const randomFile = files[Math.floor(Math.random() * files.length)]
        res.customPile = `file://${path.join(charPileDir, randomFile).replace(/\\/g, "/")}`
      }
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

    const roleId = await DataLoader.getRoleId(inputName)
    if (!roleId) return e.reply(`❌ 未找到角色ID: ${inputName}`)

    // 检查是否持有该角色
    const ownedRoles = wavesApi.dbUser?.gameData?.roleList || []
    const isRover = ROVER_ID.includes(Number(roleId))
    const isOwned = isRover
      ? ROVER_ID.some(id => ownedRoles.includes(id))
      : ownedRoles.includes(Number(roleId))

    if (!isOwned) {
      return e.reply(`请先发送 "${config.exampleCommond("面板")}" 后使用本功能查看角色详细面板`)
    }

    const apiResponse = await wavesApi.getRoleDetail(roleId)
    if (!apiResponse?.status)
      return e.reply(`❌ 获取角色数据失败: ${apiResponse?.msg || "未知错误"}`)

    const roleCard = new Waves2RoleCard(apiResponse.data).toRoleCard()
    const panelData = new PanelBuilder(roleCard).get()
    if (!panelData) return e.reply("❌ 面板数据构建失败")

    const { customBg, customPile } = this.getCustomAssets(roleId)
    const img = await this.render("character/profile-detail-v2", {
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
