# ams-plugin

<p align="center">
  <img src="ICON.png" width="200" height="200" alt="ams-plugin icon">
</p>

<p align="center">
  「 我会消灭，意图毁灭的恶。 」
</p>

---

## 📖 项目简介

`ams-plugin` 是一个基于 Yunzai-Bot 的《鸣潮》游戏数据插件。

---

## 🤖 开发理念

本项目采用 **「以 AI 为主，人工为辅」** 的敏捷开发模式。

---

## 🚀 安装步骤

在您的 Yunzai-Bot 根目录下运行：

### 1. 克隆仓库

```bash
# GitHub (主库)
git clone https://github.com/tyql688/ams-plugin.git ./plugins/ams-plugin

# 或者 cnb.cool (镜像库)
git clone https://cnb.cool/tyql688/ams-plugin.git ./plugins/ams-plugin
```

### 2. 安装依赖

```bash
pnpm install --filter=ams-plugin
```

---

## 自定义背景

插件启动时创建以下目录，将图片直接放入对应目录即可。支持 PNG、JPG、JPEG、WebP，每次绘图随机选取一张，添加图片后下次绘图生效。

```text
plugins/ams-plugin/data/custom/bg/
├── help/             # 帮助、设置
├── wiki/             # Wiki
├── query/            # 其他查询
└── panel/            # 角色详情面板，含极限面板
    ├── common/       # 面板通用背景
    ├── glacio/       # 冷凝
    ├── fusion/       # 热熔
    ├── electro/      # 导电
    ├── aero/         # 气动
    ├── spectro/      # 衍射
    └── havoc/        # 湮灭
```

角色详情面板优先从对应属性目录选图，属性目录无图片时使用 `panel/common`。其他页面只使用所属目录。每个目录只读取直接放入的图片，未选到图片时保留该模块的默认背景。

角色面板背景支持主人指令管理；省略属性时操作 `panel/common`，指定属性时操作对应目录。属性可写“冷凝、热熔、导电、气动、衍射、湮灭”，也可显式写“通用”。以下示例使用 `ams` 前缀：

| 指令 | 用途 |
| --- | --- |
| `ams上传背景图` / `ams上传热熔背景图` | 随消息发送图片或引用图片上传 |
| `ams背景图列表` / `ams热熔背景图列表` | 查看所选目录中的背景及 ID |
| `ams删除背景图 ID` / `ams删除热熔背景图 ID` | 删除所选目录中对应 ID 或完整文件名的图片 |
| `ams背景原图` / `ams原图` | 引用普通或极限面板，分别获取本次使用的背景或立绘 |

---

## 🔗 相关链接

- **GitHub 主库**: [tyql688/ams-plugin](https://github.com/tyql688/ams-plugin)
- **CNB 镜像库**: [tyql688/ams-plugin (CNB)](https://cnb.cool/tyql688/ams-plugin)

---

## 🛠️ 鸣谢与声明

- 本项目由 AI 辅助驱动，可能包含部分由 AI 生成的审美风格。

---

<p align="right">Made with ❤️ and AI.</p>
