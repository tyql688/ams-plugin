import { ELE_ID_MAP, ELE_NAME_MAP } from "#waves.core"
import fs from "fs"
import path from "path"
import { randomFiles } from "./utils.js"

export const PANEL_BG_TYPES = {
  通用: "common",
  ...Object.fromEntries(Object.entries(ELE_ID_MAP).map(([id, name]) => [name, ELE_NAME_MAP[id]])),
}

export function initCustomBgDirs(root) {
  const directories = [
    "help",
    "wiki",
    "query",
    ...Object.values(PANEL_BG_TYPES).map(type => `panel/${type}`),
  ]
  for (const directory of directories) {
    fs.mkdirSync(path.join(root, directory), { recursive: true })
  }
}

export function randomCustomBg(root, renderPath, elem) {
  const [module, template] = renderPath.replace(/\.html$/, "").split("/")
  if (module === "anns") return null

  if (module === "character" && template === "profile-detail") {
    return (
      (elem && randomFiles(path.join(root, "panel", elem))) ||
      randomFiles(path.join(root, "panel", "common"))
    )
  }

  const directory = { help: "help", settings: "help", wikis: "wiki" }[module] || "query"
  return randomFiles(path.join(root, directory))
}
