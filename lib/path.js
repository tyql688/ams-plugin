import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const metaUrl = import.meta.url

const metaPath = fileURLToPath(new URL(metaUrl))

// 插件目录
export const pluginPath = path.join(metaPath, "../../")

// 插件名称
export const pluginName = path.basename(pluginPath)

// app目录
export const appPath = path.join(pluginPath, "apps")

// 用户配置目录
export const configPath = path.join(pluginPath, "config")

// 默认配置目录
export const defPath = path.join(pluginPath, "defSet")

// 数据目录
export const dataPath = path.join(pluginPath, "data")

// 抽卡记录目录
export const gachaPath = path.join(dataPath, "gacha")
if (!fs.existsSync(gachaPath)) {
  fs.mkdirSync(gachaPath, { recursive: true })
}

// 网页模版目录
export const templatePath = path.join(pluginPath, "templates")

// 资源路径
export const resourcePath = path.join(pluginPath, "resources")

// 帮助路径
export const helpPath = path.join(resourcePath, "help")

// 头像框路径
export const framePath = path.join(resourcePath, "common", "imgs", "frame")

// 自定义路径
export const customPath = path.join(dataPath, "custom")
export const customBgPath = path.join(customPath, "bg")
export const customPilePath = path.join(customPath, "pile")
export const customAliasPath = path.join(customPath, "alias")

// ---------------------------------------------------------------------

// images
const wavesPath = path.join(resourcePath, "waves-res")
export const wavesResMap = {
  roleAvatar: path.join(wavesPath, "role", "avatar"),
  rolePile: path.join(wavesPath, "role", "pile"),
  roleChain: path.join(wavesPath, "role", "chain"),
  roleSkill: path.join(wavesPath, "role", "skill"),
  weapon: path.join(wavesPath, "weapon"),
  echo: path.join(wavesPath, "echo"),
  group: path.join(wavesPath, "group"),
  prop: path.join(wavesPath, "prop"),
}

export const wavesDataMap = {
  roleData: path.join(wavesPath, "data", "role"),
  weaponData: path.join(wavesPath, "data", "weapon"),
  echoData: path.join(wavesPath, "data", "echo"),
  alias: path.join(wavesPath, "data", "alias"),
  roleList: path.join(wavesPath, "data", "character.json"),
  weaponList: path.join(wavesPath, "data", "weapon.json"),
  echoList: path.join(wavesPath, "data", "echo.json"),
  echoGroup: path.join(wavesPath, "data", "echo_sets.json"),
}
