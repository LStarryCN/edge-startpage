# LStarry New Tab

一个为 Microsoft Edge 设计的私人新标签页扩展。页面以本地概念艺术壁纸为主体，在不增加主页组件的前提下提供秒级时间、搜索与命令面板、可排序快捷网站、沉浸模式、空闲氛围模式和本地个性化设置。

项目使用 Manifest V3、原生 HTML、CSS 和 JavaScript。无需构建、运行时依赖或 CDN，所有界面资源均保存在本地。

## 安装

1. 在 Edge 地址栏打开 `edge://extensions`。
2. 开启“开发人员模式”。
3. 点击“加载解压缩的扩展”。
4. 选择包含 `manifest.json` 的项目根目录。
5. 打开新标签页。

修改项目文件后，在扩展卡片上点击“重新加载”，再打开新的标签页查看结果。

## 键盘快捷键

- `/`：聚焦搜索框。
- `↑` / `↓`：在搜索建议或命令结果中移动。
- `Enter`：执行当前搜索、网址或命令。
- `Shift + Delete`：删除当前选中的本地搜索历史。
- `Esc`：依次关闭建议、右键菜单、个人浮层或设置。
- `Alt + 1` 到 `Alt + 9`：按当前 Dock 顺序快速打开对应网站，可在设置中关闭。
- `Shift + Space`：切换沉浸模式，输入框中不会触发。
- `Shift + F10` / Context Menu：为聚焦的 Dock 项打开快捷菜单。
- `Tab`：在快捷链接、菜单与设置控件间导航。

## 搜索与 Command Palette

普通输入保留 Google / Bing 搜索和在线联想。本地 Recent Searches 会优先合并显示，最多保存 20 条，按大小写不敏感方式去重。鼠标悬停历史项时可点击 `×` 删除，也可使用 `Shift + Delete`。

输入 `>` 进入 Command Palette，并继续复用同一个建议面板：

- `> github`、`> gh`、`> chatgpt`、`> gpt`、`> cf`、`> lc`：匹配并打开 Dock 网站。
- `> settings` / `> config`：打开设置。
- `> immersive`：切换沉浸模式。
- `> motion`：切换动效。
- `> wallpaper`：打开 Wallpaper Library。
- `> export`：导出配置。

以 `http://`、`https://`、`localhost` 或 `192.168.x.x` 开头的地址会直接打开。

## Dock

- 默认图标继续保持统一的灰白风格，仅在 Hover / Focus 时出现低饱和品牌色暗示。
- 使用原生 Drag & Drop 拖拽排序，结果立即写入现有配置并在刷新后保留。
- 右键菜单支持 Open、Open in New Tab、Edit、Move to First 和 Delete；菜单会自动避开视口边缘。
- 设置中的上下移动按钮继续保留，作为键盘和触摸环境的排序替代方式。

## Wallpaper Library 与 Accent

默认壁纸仍为 `assets/backgrounds/main-wallpaper.jpg`。内置的 Main Wallpaper、Midnight 和 Graphite 均保留。

可在设置中导入不超过 12 MB 的 JPG、PNG 或 WebP。原图 Blob 与缩略图保存在 IndexedDB，`localStorage` 只保存壁纸 ID、名称、类型、大小和 Accent 等元数据，不会保存大型 Base64 图片。导入时只进行一次 32×32 采样，生成受约束的低饱和 Accent，之后直接复用。

Accent 只用于 Focus ring、搜索选中项、Dock 指示器和设置选中状态。删除当前自定义壁纸时会安全回退到 Main Wallpaper。

## 空闲、视差与秒钟

- 默认连续 25 秒没有鼠标、键盘、滚轮或触摸操作后进入 Idle Ambient Mode；时间保持可见，其余界面柔和降低存在感。
- 搜索输入、设置、右键菜单、确认框或沉浸模式开启时不会进入 Idle。
- 背景视差最大约水平 5 px、垂直 3.5 px，使用同一个按需启动的 RAF 平滑跟随；Idle、Motion Off、页面隐藏或 `prefers-reduced-motion` 时停止。
- 秒钟与主时间按基线组合，保持直接更新，不使用持续吸引注意力的淡入或滑动动画。

## 数据与兼容

设置可导出 / 导入 `lstarry-edge-startpage-config.json`。导入会先检查版本与字段结构，再经 `validateConfig()` 和 `normalizeConfig()` 补全缺失值、忽略未知字段，并在确认后实时应用。自定义壁纸配置只导出元数据，图片 Blob 仍保存在当前浏览器的 IndexedDB 中。

配置继续使用原有的 `starry-new-tab-config-v2` localStorage key。旧配置缺少 `idleAmbient`、`quickLaunch`、`accent` 或 `wallpaperLibrary` 时会自动补默认值；现有快捷网站、搜索引擎、时间、壁纸、动效和沉浸设置不会被主动清空。最近搜索继续使用独立的 `starry-recent-searches-v1` key。

## Edge 主题建议

扩展不会读取或修改 Edge 标签栏、地址栏或浏览器主题，也没有申请相关权限。HTML 已设置与当前壁纸协调的深蓝灰 `theme-color`。为获得最佳视觉融合，建议 Edge 使用 Dark Theme、深蓝灰主题或接近当前壁纸的深色主题。

## 隐私与权限

配置、最近搜索和自定义壁纸只保存在本机。只有在普通搜索模式输入内容时，扩展才会向当前选择的建议服务发送查询文字；命令模式不会发起建议请求。页面隐藏、输入变化或建议关闭时，未完成请求会被取消。

Manifest 权限没有扩大，仍只声明两个精确主机：

- `https://suggestqueries.google.com/*`
- `https://api.bing.com/*`

不包含 `<all_urls>`，也没有新增通用 `permissions`。在线建议不可用时会静默保留本地历史，搜索本身不受影响。

## 项目结构

```text
.
|-- manifest.json
|-- index.html
|-- README.md
|-- css/style.css
|-- js/
|   |-- main.js
|   |-- config.js
|   |-- icons.js
|   |-- clock.js
|   |-- search.js
|   |-- dock.js
|   |-- background.js
|   |-- settings.js
|   |-- wallpaper.js
|   `-- ui.js
|-- tests/smoke.mjs
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

检查覆盖 Manifest V3、最小权限、资源路径、JavaScript 语法、旧配置迁移、Command Palette、历史归一化、拖拽排序算法、壁纸色彩约束、秒级时间和窄屏 Dock 图标显示。

界面图标来自 [Tabler Icons](https://tabler.io/icons)，品牌图标来自 [Simple Icons](https://simpleicons.org)。
