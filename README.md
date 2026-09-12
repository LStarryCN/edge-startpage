# LStarry New Tab

一个为 Microsoft Edge 设计的私人新标签页扩展。它以本地概念艺术壁纸为视觉主体，提供秒级时间、搜索建议、快捷网站、沉浸模式与轻量个性化设置。

项目使用 Manifest V3、原生 HTML、CSS 和 JavaScript。无需构建、运行时依赖或 CDN，所有界面资源都保存在本地。

## 安装

1. 在 Edge 地址栏打开 `edge://extensions`。
2. 开启右侧的“开发人员模式”。
3. 点击“加载解压缩的扩展”。
4. 选择包含 `manifest.json` 的项目根目录。
5. 打开新标签页。

修改项目文件后，在扩展卡片上点击“重新加载”，再打开新的标签页查看结果。

## 使用

- `/`：聚焦搜索框。
- `↑` / `↓`：在搜索建议中移动。
- `Enter`：打开当前建议、搜索或直接访问输入的网址。
- `Esc`：先收起搜索建议，再取消搜索、关闭个人浮层或关闭设置。
- `Shift + Space`：切换沉浸模式，输入框中不会触发。
- `Tab`：在快捷链接与设置控件之间进行键盘导航。

搜索默认使用 Google，也可在设置中切换为 Bing。建议列表优先显示匹配的本地搜索历史，再合并当前搜索引擎的在线建议；历史精确去重并最多保留 20 条。以 `http://`、`https://`、`localhost` 或 `192.168.x.x` 开头的地址会直接打开。

右上角的四角图标用于进入沉浸模式，齿轮图标用于打开设置。设置支持壁纸、暗度、搜索引擎、12/24 小时制、快捷网站顺序与开关动效。所有偏好仅保存在浏览器本地的 `localStorage` 中。

## 背景与头像

- 默认壁纸：`assets/backgrounds/main-wallpaper.jpg`
- 头像：`assets/avatar/avatar.jpeg`

如果壁纸加载失败，页面会使用深蓝灰渐变作为后备背景。头像不可用时，个人浮层会显示名称首字母占位。

快捷网站会优先使用项目内置的品牌图标；其他站点尝试读取站点根目录的 `favicon.ico`，加载失败时使用稳定配色的名称首字母，不会显示破图。旧版快捷方式配置会在读取时自动补齐新的图标模式字段。

## 隐私与网络权限

页面配置和最近搜索仅保存在本机 `localStorage`。只有在输入搜索内容时，扩展才会向当前选择的建议服务发送查询文字；页面隐藏、输入变化或建议关闭时，未完成的请求会被取消。

Manifest 只声明以下两个精确主机权限，不包含 `<all_urls>`：

- `https://suggestqueries.google.com/*`
- `https://api.bing.com/*`

在线建议不可用时会静默保留本地历史建议，搜索本身不受影响。

## 项目结构

```text
.
|-- manifest.json
|-- index.html
|-- README.md
|-- css/
|   `-- style.css
|-- js/
|   |-- main.js
|   |-- config.js
|   |-- icons.js
|   |-- clock.js
|   |-- search.js
|   |-- dock.js
|   |-- background.js
|   `-- settings.js
|-- tests/
|   `-- smoke.mjs
`-- assets/
    |-- icons/
    |-- avatar/
    `-- backgrounds/
```

## 检查

项目检查不需要安装依赖：

```powershell
node tests/smoke.mjs
```

检查内容包括 Manifest V3、最小主机权限、资源路径、JavaScript 语法、旧配置迁移、秒级时间、名称引用、图标解析、建议合并与搜索目标解析。

界面图标来自 [Tabler Icons](https://tabler.io/icons)，品牌图标来自 [Simple Icons](https://simpleicons.org)。
