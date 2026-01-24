import YAML from "yaml"
import chokidar from "chokidar"
import fs from "fs"
import path from "path"
import { configPath, defPath, pluginName } from "./path.js"

class Setting {
  constructor() {
    this.defPath = defPath
    this.defSet = {}

    this.configPath = configPath
    this.config = {}

    this.watcher = { config: {}, defSet: {} }

    this.initCfg()
  }

  initCfg() {
    const files = fs.readdirSync(this.defPath).filter(file => file.endsWith(".yaml"))
    for (let file of files) {
      if (!fs.existsSync(path.join(this.configPath, file))) {
        fs.copyFileSync(path.join(this.defPath, file), path.join(this.configPath, file))
      }
      this.watch(path.join(this.configPath, file), file.replace(".yaml", ""), "config")
    }
  }

  merge() {
    let sets = {}
    let appsConfig = fs.readdirSync(this.defPath).filter(file => file.endsWith(".yaml"))
    for (let appConfig of appsConfig) {
      let filename = appConfig.replace(/.yaml/g, "").trim()
      sets[filename] = this.getConfig(filename)
    }
    return sets
  }

  analysis(config) {
    for (const key of Object.keys(config)) {
      this.setConfig(key, config[key])
    }
  }

  getData(filepath, filename) {
    filename = `${filename}.yaml`
    filepath = path.join(this.dataPath, filepath)
    try {
      if (!fs.existsSync(path.join(filepath, filename))) {
        return false
      }
      return YAML.parse(fs.readFileSync(path.join(filepath, filename), "utf8"))
    } catch (error) {
      logger.error(`[ams] [${filename}] 读取失败 ${error}`)
      return false
    }
  }

  setData(filepath, filename, data) {
    filename = `${filename}.yaml`
    filepath = path.join(this.dataPath, filepath)
    try {
      if (!fs.existsSync(filepath)) {
        fs.mkdirSync(filepath, { recursive: true })
      }
      fs.writeFileSync(path.join(filepath, filename), YAML.stringify(data), "utf8")
      return true
    } catch (error) {
      logger.error(`[ams] [${filename}] 写入失败 ${error}`)
      return false
    }
  }

  getdefSet(app) {
    return this.getYaml(app, "defSet")
  }

  getConfig(app) {
    return { ...this.getdefSet(app), ...this.getYaml(app, "config") }
  }

  mergeConfigObjectArray(obj1, obj2) {
    for (const key in obj2) {
      if (Array.isArray(obj2[key]) && Array.isArray(obj1[key])) {
        const uniqueElements = new Set([...obj1[key], ...obj2[key]])
        obj1[key] = [...uniqueElements]
      } else {
        obj1[key] = obj2[key]
      }
    }

    return obj1
  }

  setConfig(app, obj) {
    const defSet = this.getdefSet(app)
    const config = this.getConfig(app)
    return this.setYaml(app, "config", { ...defSet, ...config, ...obj })
  }

  setSingleConfig(app, key, value) {
    const defSet = this.getdefSet(app)
    const config = this.getConfig(app)
    if (value instanceof Object) {
      config[key] = { ...config[key], ...value }
    } else {
      config[key] = value
    }
    return this.setYaml(app, "config", { ...defSet, ...config })
  }

  addArrayleConfig(app, key, value) {
    const defSet = this.getdefSet(app)
    const config = this.getConfig(app)
    if (!config[key]) {
      config[key] = []
    }
    config[key].push(value)
    return this.setYaml(app, "config", { ...defSet, ...config })
  }

  removeArrayleConfig(app, key, value) {
    const defSet = this.getdefSet(app)
    const config = this.getConfig(app)
    if (!config[key]) {
      return false
    }
    config[key] = config[key].filter(item => item !== value)
    return this.setYaml(app, "config", { ...defSet, ...config })
  }

  setYaml(app, type, Object) {
    let file = this.getFilePath(app, type)
    try {
      fs.writeFileSync(file, YAML.stringify(Object), "utf8")
    } catch (error) {
      logger.error(`[${app}] 写入失败 ${error}`)
      return false
    }
  }

  getYaml(app, type) {
    let file = this.getFilePath(app, type)
    if (this[type][app]) return this[type][app]

    try {
      this[type][app] = YAML.parse(fs.readFileSync(file, "utf8"))
    } catch (error) {
      logger.error(`[${app}] 格式错误 ${error}`)
      return false
    }
    this.watch(file, app, type)
    return this[type][app]
  }

  getFilePath(app, type) {
    const appFilename = `${app}.yaml`
    if (type === "defSet") return path.join(this.defPath, appFilename)
    else {
      try {
        if (!fs.existsSync(path.join(this.configPath, appFilename))) {
          fs.copyFileSync(
            path.join(this.defPath, appFilename),
            path.join(this.configPath, appFilename),
          )
        }
      } catch (error) {
        logger.error(`[ams]缺失默认文件[${app}]${error}`)
      }
      return path.join(this.configPath, `${app}.yaml`)
    }
  }

  watch(file, app, type = "defSet") {
    if (this.watcher[type][app]) return

    const watcher = chokidar.watch(file)
    watcher.on("change", path => {
      delete this[type][app]
      logger.mark(`[ams][修改配置文件][${type}][${app}]`)
      if (this[`change_${app}`]) {
        this[`change_${app}`]()
      }
    })
    this.watcher[type][app] = watcher
  }

  fixCommond(command) {
    const config = this.getConfig("prefix")
    const prefixes = config.prefixes || []
    const allowEmpty = config.allowEmptyPrefix || false

    let escapedPrefixes = prefixes
      .filter(p => p && typeof p === "string")
      .map(p => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))

    let regexParts = [...escapedPrefixes]

    if (allowEmpty) regexParts.push("")
    if (regexParts.length === 0) return `^(?!.*)$`

    const prefixPattern = regexParts.length > 1 ? `(?:${regexParts.join("|")})` : regexParts[0]
    return `^${prefixPattern}${command}$`
  }

  exampleCommond(command) {
    const config = this.getConfig("prefix")
    const prefixes = config.prefixes || []
    if (prefixes.length === 0) return command
    return `${prefixes[0]}${command}`
  }
}

export default new Setting()
