# dsh-personal-model-picker

DeepSeek Harness（DSH）的**紧凑双栏模型选择器**。它替换 DSH 自带的模型入口，把「供应商 / 模型」选择和独立的「思考等级」菜单合并到一个紧凑面板里。

| | |
|---|---|
| 版本 | 1.1.0 |
| 类型 | DSH 客户端插件（`platform: web`，需要桌面宿主 WebView） |
| 许可证 | MIT（版权归上游，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)） |
| 验证基线 | DSH 核心 `0.1.5-rc.2`；官方桌面版 44.0.0 尚待验证 |
| 官方性 | **非官方插件** —— 改编自官方包 `@deepseek-ai/dsh-client-ui-model-selection@0.1.5-rc.2`，不是 DeepSeek 发布或背书的作品 |

## 它是「替换」，不是「叠加」

`cordis.patch.yml` 只有两件事：

```yaml
- id: ui-model-selection
  disabled: true                      # 先禁用官方模型入口
- insert:
    - id: dsh-personal-model-picker   # 再插入本插件
      name: dsh-personal-model-picker
```

所以它就是官方那个入口的替代品。**停用本插件、重启宿主，官方入口会回来。**

## 界面

### 触发按钮（输入框旁）

同时显示当前模型名与思考等级，宽度自适应输入框容器：

```
[ deepseek-v4-pro   标准  ▾ ]
```

### 展开后的根菜单：两行

```
┌────────────────────────────────┐
│ 模型         deepseek-v4-pro  › │
│ 思考等级      标准             › │
└────────────────────────────────┘
```

两行各自展开成自己的列表。

### 「模型」展开后：供应商 + 模型 双栏

实际布局是 CSS Grid，列宽 `minmax(0, 1fr) minmax(0, 3fr)`（下图为示意图，供应商与模型名均为占位示例）：

```
┌──────────────┬────────────────────────────┐
│ 供应商        │  deepseek-官方   （吸顶）    │
├──────────────┤                            │
│ deepseek-官方 ●│  v4-flash  ✓              │
│ 示例中转      │  v4-pro                    │
│ …            │  …                         │
└──────────────┴────────────────────────────┘
     左栏 1fr            右栏 3fr（跨两行，各自滚动）
```

- **左栏**：供应商列表，`role="menuitemradio"`，可键盘操作
- **右栏**：当前选中供应商的模型列表，表头吸顶；切换供应商时右栏滚动位置重置
- **卡片高度固定**：`MODEL_PANE_HEIGHT = 348px`（28px 列头 + 320px 模型列 + 卡片内边距），不随悬停供应商的模型数量变化
- 点选即提交，没有二次确认

> **高度为什么必须是常量**：`place()` 按**下边缘**定位卡片（`top = 触发按钮上沿 − 8 − 实测高度`）。一旦高度跟随悬停供应商的模型数量变化，卡片顶边就会上下移动，静止的鼠标指针下方随之换成另一个供应商，于是触发换栏、再次改变高度——形成「界面上下乱飞」的反馈环。固定高度后，悬停只切换右栏内容，两栏各自滚动。

### 「思考等级」展开后

独立一栏，不与模型列表混排。模型未声明可调等级时，提示「当前使用供应商默认设置。此模型未声明可调推理等级，不会额外发送等级参数。」

## 两个入口共享同一份状态

| 入口 | 位置 | 实现 |
|---|---|---|
| `/model` 命令 | 命令面板（`popupSelect`） | `command.register({ name: "model", … })` |
| 输入框旁的模型座位 | 插槽 `conversation.input.model` | `slots.register({ name: "conversation.input.model" }, ModelSelect)` |

两者都从 `ctx.modelDirectories`（`ModelDirectoryResolver`）取**同一个 per-session `ModelDirectory`**，因此从哪个入口改效果一致，状态不会分叉。

## 数据流

- **目录来源**：`ctx.remote.session.modelCatalog()`。一个 Host generation 内最多加载一份，所有会话共享（`ModelCatalogDirectory`），并发调用复用同一次 in-flight 请求
- **自动刷新**：`llm/adapters-updated`、`settings/document-updated`、`credentials/reference-updated`
- **重置**：`connection/reset` → `resetGeneration()`，并清空已连接会话的目录
- **提交**：`ModelDirectory.select({ provider, model, reasoningEffort? })`，写入会话的持久投影帧
- **行 id**：`${providerId}/${modelId}` 只作不透明 key，选回时按已加载数据查表，从不解析字符串

## 边界行为

- **子代理会话不可选模型**：`sessions.subagentAddress(sessionId) !== undefined` 时 `available = false`，`/model` 与座位同时禁用
- **目录加载失败**：按供应商分组列出失败行（可见但不可选），每行给出错误信息，另有「重新加载」
- **模型不可用**：阻止输入框提交并提示（`blocked.composer`），由会话投影的 `routable === false` 驱动
- **过期响应**：目录刷新后，上一代 generation 的迟到响应会被丢弃

## 语言

`src/locales.js` 内置中英双语，**中文是 key 的 source of truth**，英文逐键对齐：

| key | 中文 | English |
|---|---|---|
| `menu.provider` | 供应商 | Provider |
| `menu.model` | 模型 | Model |
| `menu.effort` | 推理等级 | Effort |
| `trigger.fallback` | 选择模型 | Select model |
| `effort.providerDefault` | 供应商默认 | Default |

内置的 `deepseek-official/deepseek-v4-flash` 与 `deepseek-v4-pro` 两款模型的描述文案也做了本地化。

思考等级展开行的前缀与无障碍标签均已本地化：前缀用 `effort.prefix`（`思考等级：` / `Effort: `），无障碍标签复用已有的 `menu.thinking`。

## 安装

1. 在 DSH 当前使用的 profile 中，通过插件管理器安装并启用本插件；仅下载或安装依赖不会自动启用 bundle patch。
2. 重启 DSH 使插件生效。若管理器显示已安装但插件未出现，请确认该插件已加入当前 profile 的 bundles。

> **Desktop 0.15.4 的坑**：它会把 `file:` 指向的 **tarball（.tgz）**依赖误判成悬空链接，并在重启时删掉。
> 这个版本的桌面端请**解压 tgz，用目录形式的 `file:` 指定**，不要直接把依赖指向 `.tgz`。

## 启用 / 禁用 / 恢复

- **停用**：dshmarket 1.47.0 的 carrier toggle 会从 `dsh.profile.bundles` 移除本包 bundle（依赖保留），其 bundle patch 不再参与下次启动组合。**停用后需重启宿主**，官方入口才会恢复。
- **恢复的前提**：profile 的最终 patch 里没有残留的强制 `disabled: true` 或强制 insert 条目。历史上那些直接改官方文件的 patch 脚本不要再跑，否则移除 bundle 也不能保证恢复。
- **已知问题**：dshmarket 1.47.0 反复开关可能留下孤立的 disabled 行。

## 兼容性

- 验证基线：DSH 核心 `0.1.5-rc.2`、旧桌面端 0.15.4；官方桌面版 44.0.0 尚待验证
- 依赖 DSH 的 slots、modelDirectories、sessions、`remote.session` 以及客户端模块加载机制
- **图标导出改过名**：0.1.5 时代是 `IconXxx14` / `IconXxx16`，0.2.0-rc.2 起统一为 `IconXxxRegular`。本插件按 `...Regular` 取名；名字对不上时图标取到 `undefined`，React 渲染 `<undefined />` 会抛错，座位项随即被槽机制除名（`abdicate`）——表现为输入框旁的模型入口**整个消失**，而不是样式错乱。对照 `@deepseek-ai/dsh-client-ui-primitives` 的实际导出即可定位
- **不保证任意核心/桌面版本兼容**；升级前请重新验证，未验证的版本不要继续用它替换官方入口
- 不是可以脱离 DSH 单独使用的通用网页组件

## 目录结构

```
.
├─ src/
│   ├─ register.js       插件入口：注册字典、/model 命令、输入框座位
│   ├─ model-select.js   输入框座位组件（触发器 + 两级菜单 + 双栏 grid）
│   ├─ directory.js      per-session 模型目录（选择 / 提交 / 持久投影）
│   ├─ catalog.js        Host generation 共享目录（含 generation 失效）
│   ├─ service.js        ModelDirectoryResolver（注册为 ctx.modelDirectories）
│   ├─ locales.js        中英字典
│   ├─ styles.js         样式（含 .personal-model-columns 双栏）
│   ├─ classnames.js     内置 clsx
│   ├─ imports.js        运行时依赖声明
│   └─ host.js           宿主侧空实现
├─ dist/                 构建产物（宿主实际加载 dist/client.cjs）
├─ cordis.patch.yml      启停 patch
├─ package.json
├─ LICENSE               MIT（上游版权声明原样保留）
└─ THIRD_PARTY_NOTICES.md
```

## 校验

```bash
npm run check      # node --check dist/index.js && node --check dist/client.cjs
```

## 第三方来源

改编自官方 npm 包 `@deepseek-ai/dsh-client-ui-model-selection@0.1.5-rc.2`（MIT，`Copyright (c) 2026 DeepSeek`）：

- 官方元数据：https://registry.npmjs.org/@deepseek-ai%2fdsh-client-ui-model-selection/0.1.5-rc.2
- 上游仓库：https://github.com/deepseek-ai/deepseek-harness，对应目录 `packages/client/ui-model-selection`
- 归档 SHA-512 已与 npm `dist.integrity` 核对一致，完整声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

React 与 DSH 宿主服务由宿主提供，不是本包随附的另一套运行时。本仓库不将本地修改冒充上游作品，也不虚构本地修改的版权归属。
