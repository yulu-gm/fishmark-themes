# 主题展示页改造设计

## 背景

当前仓库已经包含一个基于 `site/assets/data/themes.json` 的主题展示页，但主题展示数据仍然集中维护在站点目录中。这样做的成本是：每次新增主题时，需要同时修改主题目录和站点数据文件，容易出现信息重复、遗漏和不同步。

本次改造的目标是以用户提供的参考页面 `C:/Users/yulu/Downloads/index.html` 作为新的主页视觉方向，同时把主题展示数据的维护方式改为“主题目录自治”。新增主题时，应当优先在 `themes/<theme-id>/` 下补齐固定命名的元数据和素材，再通过脚本自动汇总生成站点使用的数据文件。

## 目标

1. 新主页的整体结构和视觉风格参考用户提供的静态页面。
2. 新增主题时，不再手工编辑 `site/assets/data/themes.json`。
3. 每个主题目录按统一契约维护展示信息。
4. 即使主题只提供最基础的 `manifest.json`，页面也可以正常展示和提供下载入口。
5. 主题目录下若存在固定命名的 `cover.png`，展示页优先直接使用该图片；若不存在，则根据主题颜色和缺省规则自动生成展示卡片。

## 非目标

1. 不改动主题运行时契约本身，`manifest.json` 仍然服务于主题加载和参数定义。
2. 不要求所有主题必须立即补齐完整展示素材。
3. 不引入复杂的站点框架或额外构建系统，尽量沿用当前的静态站点结构。

## 现状概览

当前仓库结构：

- `themes/`：主题源目录
- `site/`：GitHub Pages 展示页
- `site/assets/data/themes.json`：当前主题展示数据总表
- `scripts/package-themes.ps1`：主题打包脚本

当前主题页已经是数据驱动渲染，但存在两个问题：

1. 展示数据与主题目录分离，新增主题需要维护两处。
2. 参考页面里更完整的导航、英雄区和双态主题卡片还没有迁移到当前站点中。

## 主题目录契约

每个主题继续放在 `themes/<theme-id>/`，展示页和生成脚本都只识别这一层目录。推荐的固定结构如下：

```text
themes/<theme-id>/
  manifest.json
  showcase.json
  cover.png
  tokens/
  styles/
  shaders/
  assets/
```

其中：

- `manifest.json`：必需，主题正式元数据
- `showcase.json`：可选，展示页补充信息
- `cover.png`：可选，主题封面图，固定文件名

### 文件职责

`manifest.json` 继续承担主题运行时需要的信息，例如：

- `id`
- `name`
- `version`
- `supports`
- `parameters`

`showcase.json` 只承担展示页需要但无法稳定从 `manifest.json` 自动推导的补充信息，例如：

- 一句短标语
- 一段详细简介
- 自定义展示标签
- 回退卡片颜色
- 回退卡片背景描述
- 排序和显隐控制

`cover.png` 用于主题展示卡片的主视觉。展示页生成数据时，如果检测到该文件存在，则优先将其作为封面图使用。

## showcase.json 规范

建议采用如下结构：

```json
{
  "tagline": "一句短标语",
  "summary": "一段详细简介",
  "features": ["标签1", "标签2"],
  "accent": {
    "start": "#ff934f",
    "end": "#7a2310"
  },
  "surface": {
    "type": "gradient",
    "value": "radial-gradient(...), linear-gradient(...)"
  },
  "order": 10,
  "hidden": false
}
```

### 字段说明

- `tagline`
  主题卡片标题下方的一句短描述
- `summary`
  主题的详细简介
- `features`
  展示标签数组
- `accent.start`
  主题强调色起始色，用于按钮或标记
- `accent.end`
  主题强调色结束色，用于按钮或标记
- `surface.type`
  当前只规划 `gradient`
- `surface.value`
  没有 `cover.png` 时用于回退渲染的背景定义
- `order`
  页面排序值，值越小越靠前
- `hidden`
  为 `true` 时不在展示页显示该主题

## 缺省规则

为了保证新增主题的最低接入成本，页面必须支持按“从强到弱”的顺序回退。

### 主视觉回退

1. 如果存在 `cover.png`，优先使用封面图。
2. 如果没有 `cover.png`，但 `showcase.json` 提供了 `surface`，则使用 `surface` 生成自动卡片。
3. 如果两者都没有，使用通用缺省卡片，以主题名、模式和参数数量生成简洁占位视觉。

### 文案回退

- 标题：使用 `manifest.json.name`
- 版本：使用 `manifest.json.version`
- 模式：根据 `manifest.json.supports.light` 与 `manifest.json.supports.dark` 自动推导
- 短标语：优先 `showcase.json.tagline`，否则生成缺省文案，例如“支持 Dark 模式，提供 4 项可调参数。”
- 详细简介：优先 `showcase.json.summary`，否则根据模式、参数数量、是否存在 shader 或贴图生成一段简版简介
- 展示标签：优先 `showcase.json.features`，否则自动生成，例如“暗色专用”“双模式”“动态背景”“4 项参数”“贴图材质”

### 参数回退

1. 优先使用 `manifest.json.parameters[*].label`
2. 没有 `label` 但有 `id` 时，使用 `id`
3. 如果 `parameters` 不存在或为空，则整个参数区域隐藏

### 下载文件回退

默认下载包命名约定为：

```text
<theme-id>-<version>.zip
```

展示页默认按上述规则生成下载文件名，减少主题目录内额外配置。若未来个别主题存在特殊命名，可以再允许 `showcase.json` 增加可选覆盖字段，但当前设计不强制引入。

### 排序与可见性回退

1. 优先按 `showcase.json.order`
2. 未提供时按目录名排序
3. 默认展示全部主题，除非 `showcase.json.hidden = true`

## 生成流程

由于 GitHub Pages 的静态页面无法直接扫描仓库目录，因此采用“主题目录自治 + 构建脚本汇总”的方式。

### 流程步骤

1. 扫描 `themes/*/manifest.json`
2. 读取同目录下可选的 `showcase.json`
3. 检查同目录下是否存在固定文件名 `cover.png`
4. 如果存在 `cover.png`，将其复制到站点可发布目录，例如 `site/assets/generated/covers/<theme-id>.png`
5. 套用缺省规则，生成标准化的主题展示对象
6. 输出到 `site/assets/data/themes.json`

### 标准化后的站点数据结构

建议生成后的每个主题对象至少包含：

```json
{
  "id": "ember-ascend",
  "name": "Ember Ascend",
  "version": "1.0.0",
  "modes": ["dark"],
  "tagline": "余烬从工作区中央慢慢上升，适合专注写作与深色阅读。",
  "summary": "以暗场背景承接高热度中心光束，让正文像从低照度舞台里浮现出来。",
  "features": ["暗色专用", "动态背景", "4 项参数"],
  "parameters": ["余烬强度", "色温", "上升呼吸", "工作区毛玻璃"],
  "coverImage": "./assets/generated/covers/ember-ascend.png",
  "accentStart": "#ff934f",
  "accentEnd": "#7a2310",
  "surface": "radial-gradient(...), linear-gradient(...)",
  "downloadFile": "ember-ascend-1.0.0.zip"
}
```

说明：

- `coverImage` 可以为空；为空时前端走自动卡片分支
- `surface` 可以是缺省生成值；前端不需要再自行推导复杂规则
- `downloadFile` 始终由脚本产出，前端只负责拼接下载地址
- 由于 GitHub Pages 当前只发布 `site/` 目录，`coverImage` 必须指向站点产物中的可访问路径，而不是直接引用 `themes/` 下的源文件

## 页面改造范围

主页视觉以用户提供的 `index.html` 为参考，整体结构保持静态站点实现，不引入额外框架。

### 保留的页面组织

- `site/index.html`
- `site/assets/site.css`
- `site/assets/site.js`
- `site/assets/data/themes.json`

### 改造方向

1. 顶部改为固定导航栏
2. 首页增加完整英雄区
3. 主题库区域切换为更完整的大卡片布局
4. 安装说明区和页脚按参考稿重组
5. 主题卡片支持两种视觉模式：
   - 图片封面模式
   - 自动生成的氛围卡片模式

### 主题卡片渲染分支

前端只消费标准化后的站点数据：

- 有 `coverImage`：渲染图片封面
- 无 `coverImage`：渲染 `surface` 和 `accent` 驱动的自动卡片

因此页面模板对未来新增主题保持稳定，不需要继续按主题写死 HTML。

## 脚本职责

新增一个展示数据生成脚本，职责仅限于：

1. 扫描主题目录
2. 合并 `manifest.json`、`showcase.json` 和 `cover.png`
3. 套用缺省规则
4. 将封面图同步到 `site/` 下的发布目录
5. 生成 `site/assets/data/themes.json`

该脚本不负责：

1. 修改主题运行时文件
2. 参与主题本体打包
3. 变更 Release 命名策略

为了方便使用，该脚本应支持：

- 单独运行以刷新站点数据
- 被现有打包或发布流程调用

## 文档要求

需要补充一份中文维护文档，说明新增主题时的最小接入要求和可选增强方式。

文档至少应包含：

1. 目录结构约定
2. `showcase.json` 字段说明
3. `cover.png` 固定命名说明
4. 缺省规则说明
5. 新增主题后的本地刷新方式

## 验证方案

实现完成后至少验证以下场景：

1. 主题目录仅有 `manifest.json`
2. 主题目录有 `manifest.json + showcase.json`
3. 主题目录有 `manifest.json + showcase.json + cover.png`
4. 页面中下载链接正确指向对应 zip
5. 模式徽标、参数标签和排序符合预期
6. 移动端布局在窄屏下不破版

## 实施建议

建议按以下顺序推进：

1. 先实现展示数据生成脚本与缺省规则
2. 再迁移主页结构与样式到参考稿方向
3. 然后补维护文档
4. 最后做本地验证

这样可以先稳定“新增主题如何接入”，再去调整展示层，避免页面改完后数据结构再返工。
