export const GAMES = Object.freeze({
  waves: {
    id: 3,
    name: "WutheringWaves",
    displayName: "鸣潮",
  },
  pgr: {
    id: 2,
    name: "PGR",
    displayName: "战双帕弥什",
  },
})

// 自定义立绘共享组。只影响自定义立绘，不影响角色数据、伤害计算或默认立绘。
export const CUSTOM_PILE_SHARE_GROUPS = Object.freeze([
  Object.freeze([1402, 1610]), // 秧秧 / 秧秧·玄翎
  Object.freeze([1501, 1605, 1406, 1309]), // 男主：衍射 / 湮灭 / 气动 / 导电
  Object.freeze([1502, 1604, 1408, 1310]), // 女主：衍射 / 湮灭 / 气动 / 导电
])

// 资源中的男女主同名，管理自定义立绘时用显式别名稳定落到对应共享组。
export const CUSTOM_PILE_ROLE_ALIASES = Object.freeze({
  男主: 1501,
  女主: 1502,
})
