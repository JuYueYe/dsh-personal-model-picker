# dsh-reasoning-effort

给 **官方「设置 → 模型」** 页面里每一张 pi-ai 提供商卡片，换上一套带**逐模型「思考模式」开关 + 档位勾选**的模型目录编辑器，并加上**批量开启思考模式**。

> 非官方插件。修改的是 DSH Web GUI 的界面，需要与你的 DSH 版本兼容。

## 它解决什么

`@deepseek-ai/dsh-llm-pi-ai` 的 `reasoningEfforts` 是**每个模型各自声明的能力**：它把「这个模型支持哪些思考等级」映射到「该等级在请求里实际发什么值」。官方设置页**故意不做**这个控件——源码原话：

> There is deliberately no reasoning-effort control, here or on the editor card: effort is a per-MODEL capability, and the models under one provider disagree about it, so a provider-scoped control can only be set to a value some of them reject.

结果是没有声明 `reasoningEfforts` 的模型，在模型选择器里只能显示「供应商默认」，一个等级都选不了。

官方只为外部插件留了两个座位，其中一个就在提供商卡片内部：

```
settings.models.provider-card   (keyed, replaceRisk: none, 派发键 = 该卡片的 settingsNs)
```

本插件填入 `key = llm-pi-ai`，于是出现在**每一张 pi-ai 卡片**里。

## 改了什么

**卡片接管**：这个座位渲染在官方编辑器**之前**（`<li>` 的孩子顺序是：卡片头 → 错误 → 本插件 → 官方编辑器）。所以目录一读出来，插件就把**排在自己后面的兄弟节点隐藏**，自己成为这张卡片的编辑器。

**展开 / 收起跟着官方「编辑」按钮走**：那个官方编辑器**只在卡片展开时才挂载**，所以它的存在本身就是开关信号——挂上了就渲染我们的编辑器并把它藏起来；收起了我们就什么都不渲染，卡片恢复成官方收起时的样子。用 `MutationObserver` 盯着，两边始终同步。**找不到这个结构、或目录读不出来时不隐藏也不接管**（读失败、缺 ns、没有自定义目录都走这条路），退化成原样，不会白屏。

**逐模型编辑**（对应截图的每一行）：

| 控件 | 写入 |
|---|---|
| 模型 ID / 显示名称 | `id` / `name`（清空即 unset） |
| 上下文窗口 / 最大输出 token | `contextWindow` / `maxTokens`，接受 `256K`、`1M` 或纯数字；格式非法则拒绝写入并提示 |
| 支持图片输入（开关） | `input` → `["text","image"]` / `["text"]` |
| **思考模式（开关）** | 开 → `reasoningEfforts = {off:null, low, medium, high}`；关 → unset（恢复适配器继承） |
| **思考档位（7 个勾选框）** | `off（关闭）` / `minimal（最低）` / `low（低）` / `medium（中）` / `high（高）` / `xhigh（很高）` / `max（最高）`，**中英并列**；逐个增删，只改被点的那一个键，其它键（含未知键）原样保留 |
| ✕ | 从 `models[]` 删除该行 |
| 底部「添加模型」 | 追加一行 `{id}` |

**批量**：卡片顶部的「批量开启思考模式」列出**尚未声明档位**的模型，支持全选/取消，一次写一条 `settings.mutate`（不需要再点官方那个「应用」）。

写入全部是 **`ctx.remote.settings.mutate` 的按路径最小编辑**，所以官方卡片管理的其它字段不会被重述或丢失。

**没有改的部分**：官方源码、`/model` 命令、其它适配器（`llm-deepseek` 等）、以及任何 asar 内容。宿主半是惰性的。

## 怎么装

本包位于仓库 [`JuYueYe/dsh-personal-model-picker`](https://github.com/JuYueYe/dsh-personal-model-picker) 的 `packages/dsh-reasoning-effort` 子目录。**不能用 `github:` 规格安装**——那个规格装的是仓库根目录的「双栏模型选择器」。先克隆仓库，再按绝对路径安装子目录：

```
git clone https://github.com/JuYueYe/dsh-personal-model-picker
```

然后在 **Plugins 页 → 安装** 里填 `<克隆目录>/packages/dsh-reasoning-effort`；或先 `npm pack` 打成 tgz 再填 tgz 路径。

装完**刷新页面**（Ctrl+R）；座位没出现就退出 DSH 重开。

## 怎么验证

打开 **设置 → 模型** → 任意一个 pi-ai 提供商（例如显示名 `2gpt-claude` 的 `a9527`）。它的卡片里应出现完整的模型目录编辑器。

改动后检查 profile 配置：

```
$DSH_HOME/profiles/<profile>/cordis.patch.yml
```

对应位置为 `llm-pi-ai` → `providers.<路由>` → `models[]`。

## 注意

- **只接管「已经自定义过模型目录」的提供商**（配置里有 `models[]`）。没有的话卡片会提示先用官方卡片保存一次——这样避免凭空造一份目录覆盖适配器继承。
- **官方卡片的「恢复默认模型」会删掉整个 `models` 数组**，连同这里写的档位。别点它。
- 写入带 revision，冲突会提示「配置已被别处修改」并自动重读。
- 声明能力**不等于端点真的支持**；勾了某个档位而上游不认，请求会被上游拒绝。

## 开发

```bash
npm run build   # src/client/*.js → dist/client.cjs（拼进 window.__ModuleLoader__ 工厂）
npm test        # 构建 + 离线自测（假模块加载器 + 假 React hooks，41 项）
npm run check   # 语法检查
```

`dist/` 必须提交：从 git 安装不会替你构建。

## 兼容性

| 项 | 值 |
|---|---|
| 实测基线 | DSH 核心 `0.2.0-rc.2`（官方桌面端 nightly） |
| 宿主半 | 惰性（`export function apply() {}`）——界面全在客户端半 |
| 客户端注入 | `slots`、`remote`、`remote.settings`、`locale` |
| 客户端依赖 | `@deepseek-ai/dsh-client-locale`、`@deepseek-ai/dsh-api-remotes` |
| `peerDependencies` | 刻意不写——写了会被兼容性检查按 semver 判不兼容并静默跳过 |

`remote.settings` 由 `@deepseek-ai/dsh-api-remotes` 统一挂载（它 import 各 controller 的 `/remote` 模块），所以它一定存在于 Web 客户端。

## 许可

MIT。
