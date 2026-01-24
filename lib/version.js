import fs from "fs"
import path from "path"
import { pluginPath } from "./path.js"

let packageJson = {}
try {
  packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"))
} catch (e) {}

let pluginPackageJson = {}
try {
  pluginPackageJson = JSON.parse(fs.readFileSync(path.join(pluginPath, "package.json"), "utf8"))
} catch (e) {}

const yunzaiVersion = packageJson.version
const isV3 = yunzaiVersion.startsWith("3")
let name = "Yunzai-Bot"
if (packageJson.name === "miao-yunzai") {
  name = "Miao-Yunzai"
} else if (packageJson.name === "trss-yunzai") {
  name = "TRSS-Yunzai"
}

const currentVersion = pluginPackageJson.version

const version = {
  isV3,
  name,
  get version() {
    return currentVersion
  },
  get yunzai() {
    return yunzaiVersion
  },
}

export default version
