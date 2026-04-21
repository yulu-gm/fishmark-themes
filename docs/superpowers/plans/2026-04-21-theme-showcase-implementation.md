# Theme Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把主题展示页改成参考稿风格，并改为从各主题目录的固定文件生成展示数据，支持 `cover.png` 优先展示和缺省回退。

**Architecture:** 保留 `site/` 作为纯静态站点，新增一个 PowerShell 生成脚本扫描 `themes/*` 下的 `manifest.json`、可选 `showcase.json` 和可选 `cover.png`，统一产出 `site/assets/data/themes.json` 与站点可访问的封面图目录。前端继续只消费标准化后的单一数据源，按是否有 `coverImage` 切换图片封面或自动卡片分支。

**Tech Stack:** PowerShell、GitHub Pages 静态 HTML/CSS/JS、JSON 元数据

---

## File Structure

- Create: `themes/ember-ascend/showcase.json`
  存放 Ember Ascend 的展示文案、特征标签、回退颜色和排序。
- Create: `themes/pearl-drift/showcase.json`
  存放 Pearl Drift 的展示文案、特征标签、回退颜色和排序。
- Create: `themes/rain-glass/showcase.json`
  存放 Rain Glass 的展示文案、特征标签、回退颜色和排序。
- Optional Create: `themes/rain-glass/cover.png`
  如果采用现有雨窗贴图作为封面，则新增固定文件名封面图；如果不采用，则页面走回退卡片分支。
- Create: `scripts/generate-site-data.ps1`
  扫描主题目录、合并元数据、复制封面图、生成 `themes.json`。
- Create: `site/assets/generated/covers/.gitkeep`
  确保站点封面图产物目录存在并可被提交。
- Modify: `site/assets/data/themes.json`
  改为脚本生成，不再手工维护。
- Modify: `site/index.html`
  迁移到参考稿结构，保留主题列表挂载点。
- Modify: `site/assets/site.css`
  迁移到参考稿视觉系统，并补齐图片封面卡片和回退卡片的双分支样式。
- Modify: `site/assets/site.js`
  移除硬编码 `fallbackThemes` 依赖，改为消费生成后的统一字段。
- Modify: `README.md`
  补充中文维护说明和展示数据生成步骤。

### Task 1: 建立主题目录内的展示元数据

**Files:**
- Create: `themes/ember-ascend/showcase.json`
- Create: `themes/pearl-drift/showcase.json`
- Create: `themes/rain-glass/showcase.json`
- Optional Create: `themes/rain-glass/cover.png`

- [ ] **Step 1: 写入三套主题的展示元数据样例**

```json
{
  "tagline": "余烬从工作区中央慢慢上升，适合专注写作与深色阅读。",
  "summary": "以暗场背景承接高热度中心光束，让正文像从低照度舞台里浮现出来。适合夜间写作、长段落聚焦和需要强烈视觉中心的界面偏好。",
  "features": ["暗色专用", "动态余烬背景", "色温可调", "呼吸动画可关"],
  "accent": {
    "start": "#ff934f",
    "end": "#7a2310"
  },
  "surface": {
    "type": "gradient",
    "value": "radial-gradient(circle at 50% 28%, rgba(255, 183, 77, 0.9), rgba(122, 35, 16, 0) 52%), linear-gradient(180deg, #140d0c 0%, #2f1208 54%, #0f0909 100%)"
  },
  "order": 10,
  "hidden": false
}
```

- [ ] **Step 2: 运行读取命令确认 JSON 可读**

Run:

```powershell
[System.IO.File]::ReadAllText('themes/ember-ascend/showcase.json', [System.Text.Encoding]::UTF8) | ConvertFrom-Json | Select-Object tagline, order
```

Expected: 输出 `tagline` 与 `order`，且无 JSON 解析错误。

- [ ] **Step 3: 如决定给 Rain Glass 配封面图，则复制现有雨窗贴图为固定文件名**

Run:

```powershell
Copy-Item -LiteralPath 'themes/rain-glass/assets/textures/rain-window-scene.png' -Destination 'themes/rain-glass/cover.png' -Force
```

Expected: `themes/rain-glass/cover.png` 存在，可被后续脚本识别。

- [ ] **Step 4: 再次检查主题目录契约**

Run:

```powershell
Get-ChildItem 'themes/rain-glass' | Select-Object Name
```

Expected: 至少能看到 `manifest.json`、`showcase.json`，如果执行了上一步则还能看到 `cover.png`。

- [ ] **Step 5: Commit**

```bash
git add themes/ember-ascend/showcase.json themes/pearl-drift/showcase.json themes/rain-glass/showcase.json
# 如果创建了封面图，再额外执行：
# git add themes/rain-glass/cover.png
git commit -m "feat: add theme showcase metadata"
```

### Task 2: 实现站点展示数据生成脚本

**Files:**
- Create: `scripts/generate-site-data.ps1`
- Create: `site/assets/generated/covers/.gitkeep`
- Modify: `site/assets/data/themes.json`

- [ ] **Step 1: 先写一个失败的生成脚本调用检查**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-site-data.ps1
```

Expected: 当前应失败并提示脚本不存在。

- [ ] **Step 2: 写出最小脚本骨架和核心函数**

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
}

function Read-JsonFile {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }

  ([System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8) | ConvertFrom-Json)
}

function Get-ThemeModes {
  param($Manifest)

  $modes = [System.Collections.Generic.List[string]]::new()
  if ($Manifest.supports.light) { [void]$modes.Add("light") }
  if ($Manifest.supports.dark) { [void]$modes.Add("dark") }
  return $modes.ToArray()
}
```

- [ ] **Step 3: 在脚本中补齐标准化逻辑与产物写入**

```powershell
function Get-ThemeRecord {
  param(
    [string]$ThemeDirectory,
    [string]$CoversOutputDirectory
  )

  $manifestPath = Join-Path $ThemeDirectory "manifest.json"
  $showcasePath = Join-Path $ThemeDirectory "showcase.json"
  $coverPath = Join-Path $ThemeDirectory "cover.png"

  $manifest = Read-JsonFile -Path $manifestPath
  $showcase = Read-JsonFile -Path $showcasePath

  $themeId = [string]$manifest.id
  $version = if ([string]::IsNullOrWhiteSpace([string]$manifest.version)) { "1.0.0" } else { [string]$manifest.version }
  $parameters = @($manifest.parameters | ForEach-Object {
    if (-not [string]::IsNullOrWhiteSpace([string]$_.label)) { [string]$_.label } else { [string]$_.id }
  } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  $modes = @(Get-ThemeModes -Manifest $manifest)

  $coverImage = $null
  if (Test-Path -LiteralPath $coverPath) {
    $coverTarget = Join-Path $CoversOutputDirectory "$themeId.png"
    Copy-Item -LiteralPath $coverPath -Destination $coverTarget -Force
    $coverImage = "./assets/generated/covers/$themeId.png"
  }

  [PSCustomObject]@{
    id = $themeId
    name = [string]$manifest.name
    version = $version
    modes = $modes
    tagline = if ($showcase.tagline) { [string]$showcase.tagline } else { "支持 $([string]::Join(' / ', $modes)) 模式，提供 $($parameters.Count) 项可调参数。" }
    summary = if ($showcase.summary) { [string]$showcase.summary } else { "主题展示信息未补充完整，当前以模式、参数和运行时能力生成缺省展示。" }
    features = if ($showcase.features) { @($showcase.features) } else { @("$(if ($modes.Count -gt 1) { '双模式' } else { '单模式' })", "$($parameters.Count) 项参数") }
    parameters = $parameters
    coverImage = $coverImage
    accentStart = if ($showcase.accent.start) { [string]$showcase.accent.start } else { "#8f8f8f" }
    accentEnd = if ($showcase.accent.end) { [string]$showcase.accent.end } else { "#4f4f4f" }
    surface = if ($showcase.surface.value) { [string]$showcase.surface.value } else { "linear-gradient(135deg, rgba(255,255,255,0.16), rgba(0,0,0,0.16))" }
    order = if ($null -ne $showcase.order) { [int]$showcase.order } else { 999 }
    hidden = if ($null -ne $showcase.hidden) { [bool]$showcase.hidden } else { $false }
    downloadFile = "$themeId-$version.zip"
  }
}
```

- [ ] **Step 4: 运行脚本并验证输出文件生成**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-site-data.ps1
```

Expected: 脚本成功结束，生成 `site/assets/data/themes.json`，如存在 `cover.png` 则同时生成 `site/assets/generated/covers/<theme-id>.png`。

- [ ] **Step 5: 验证生成结果结构**

Run:

```powershell
([System.IO.File]::ReadAllText('site/assets/data/themes.json', [System.Text.Encoding]::UTF8) | ConvertFrom-Json) | Select-Object id, coverImage, downloadFile
```

Expected: 每个主题都输出 `id` 和 `downloadFile`；带封面的主题有 `coverImage`，其他主题该字段为空。

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-site-data.ps1 site/assets/data/themes.json site/assets/generated/covers
git commit -m "feat: generate site theme data from theme directories"
```

### Task 3: 把主页迁移到参考稿结构

**Files:**
- Modify: `site/index.html`
- Modify: `site/assets/site.css`

- [ ] **Step 1: 先记录当前站点挂载点，避免把数据驱动入口删掉**

Run:

```powershell
rg -n "theme-grid|site.js|assets/site.css" site/index.html
```

Expected: 能看到 `#theme-grid`、`./assets/site.css`、`./assets/site.js` 的引用位置。

- [ ] **Step 2: 把 HTML 结构改到参考稿的版式，同时保留主题列表挂载点**

```html
<nav>
  <a class="nav-logo" href="#"><span>Yulora</span> / themes</a>
  <div class="nav-links">
    <a href="#themes">主题库</a>
    <a href="#install">安装</a>
    <a href="https://github.com/yulu-gm/yora-themes/issues" target="_blank" rel="noreferrer">反馈</a>
  </div>
  <a class="nav-cta" href="https://github.com/yulu-gm/yora-themes/releases/latest" target="_blank" rel="noreferrer">↓ 下载最新</a>
</nav>

<section class="hero">...</section>
<section id="themes">
  <div class="section-header">...</div>
  <div id="theme-grid" class="theme-list" aria-live="polite"></div>
</section>
<section id="install">...</section>
```

- [ ] **Step 3: 按参考稿重写 CSS 基础变量、导航、Hero、主题卡片和响应式布局**

```css
:root {
  --bg: oklch(9.5% 0.014 252);
  --bg2: oklch(12% 0.016 252);
  --bg3: oklch(15% 0.018 252);
  --line: oklch(100% 0 0 / 0.07);
  --fg: oklch(93% 0.008 80);
  --fg2: oklch(68% 0.008 80);
  --fg3: oklch(45% 0.008 80);
}

.theme-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg2);
}

.theme-card.is-reverse {
  direction: rtl;
}

.theme-preview.has-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

- [ ] **Step 4: 在窄屏下验证布局会回退为单列**

Run:

```powershell
rg -n "@media \\(max-width: 900px\\)|@media \\(max-width: 560px\\)" site/assets/site.css
```

Expected: 存在移动端媒体查询，并覆盖导航、卡片、安装步骤等核心模块。

- [ ] **Step 5: Commit**

```bash
git add site/index.html site/assets/site.css
git commit -m "feat: restyle showcase homepage to match reference"
```

### Task 4: 更新前端渲染逻辑以支持封面图与缺省卡片

**Files:**
- Modify: `site/assets/site.js`

- [ ] **Step 1: 写出当前脚本应消失的旧依赖检查**

Run:

```powershell
rg -n "fallbackThemes|theme-grid|renderThemeCard" site/assets/site.js
```

Expected: 当前仍能看到 `fallbackThemes`，后续实现完成后该常量应被删除或显著缩减为最小兜底。

- [ ] **Step 2: 重写渲染函数，支持 `coverImage` 与 `surface` 两种预览分支**

```javascript
function renderPreview(theme) {
  if (theme.coverImage) {
    return `
      <div class="theme-preview has-cover">
        <img src="${escapeHtml(theme.coverImage)}" alt="${escapeHtml(theme.name)} cover" loading="lazy" />
      </div>
    `;
  }

  return `
    <div class="theme-preview">
      <div class="theme-preview-bg" style="background:${escapeHtml(theme.surface)};"></div>
      <div class="mock-editor">
        <div class="mock-titlebar"><span class="mock-dot r"></span><span class="mock-dot y"></span><span class="mock-dot g"></span></div>
        <div class="mock-editor-body">
          <div class="mock-line h1"></div>
          <div class="mock-line xlong"></div>
          <div class="mock-line long"></div>
          <div class="mock-line med"></div>
        </div>
      </div>
    </div>
  `;
}
```

- [ ] **Step 3: 重写卡片渲染函数，消费新数据结构**

```javascript
function renderThemeCard(theme, index) {
  const reverseClass = index % 2 === 1 ? " is-reverse" : "";
  const downloadUrl = `${releaseBaseUrl}${encodeURIComponent(theme.downloadFile)}`;
  const modeBadges = (theme.modes || []).map((mode) => `<span class="mode-badge ${escapeHtml(mode)}">${escapeHtml(mode === "dark" ? "Dark" : "Light")}</span>`).join("");
  const features = createChipRow(theme.features || []);
  const parameters = createChipRow(theme.parameters || []);

  return `
    <article class="theme-card${reverseClass}">
      ${renderPreview(theme)}
      <div class="theme-info">
        <div class="theme-meta">
          <span class="theme-version">v${escapeHtml(theme.version)}</span>
          <div class="theme-modes">${modeBadges}</div>
        </div>
        <h3>${escapeHtml(theme.name)}</h3>
        <p class="theme-tagline">${escapeHtml(theme.tagline || "")}</p>
        ${theme.summary ? `<p class="theme-summary">${escapeHtml(theme.summary)}</p>` : ""}
        ${features ? `<div class="theme-features">${features}</div>` : ""}
        ${parameters ? `<div class="theme-params"><p class="params-label">可调参数</p><div class="params-list">${parameters}</div></div>` : ""}
        <div class="theme-actions">
          <a class="btn-download" style="background:linear-gradient(135deg, ${escapeHtml(theme.accentStart)}, ${escapeHtml(theme.accentEnd)})" href="${downloadUrl}">↓ 下载 ZIP</a>
          <a class="btn-details" href="https://github.com/yulu-gm/yora-themes/tree/main/themes/${escapeHtml(theme.id)}" target="_blank" rel="noreferrer">查看源码</a>
        </div>
      </div>
    </article>
  `;
}
```

- [ ] **Step 4: 调整数据加载逻辑，只把本地 `file:` 场景作为读取现有生成数据失败后的兜底**

Run:

```powershell
rg -n "fetch\\(\"\\.\\/assets\\/data\\/themes.json|window.location.protocol === \"file:\"|fallbackThemes" site/assets/site.js
```

Expected: 保留 `fetch("./assets/data/themes.json")` 主路径，本地兜底逻辑不再与正式数据长期分叉。

- [ ] **Step 5: Commit**

```bash
git add site/assets/site.js
git commit -m "feat: render showcase cards from generated theme data"
```

### Task 5: 更新仓库文档并接入生成步骤

**Files:**
- Modify: `README.md`
- Optional Modify: `.github/workflows/deploy-pages.yml`
- Optional Modify: `.github/workflows/release-themes.yml`

- [ ] **Step 1: 在 README 中补充新增主题所需的固定文件**

```md
## 展示页数据维护

每个主题目录可提供以下固定文件：

- `manifest.json`：必需
- `showcase.json`：可选，展示页文案与颜色
- `cover.png`：可选，固定命名封面图

刷新站点数据：

````powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-site-data.ps1
````
```

- [ ] **Step 2: 如果希望发布流程自动保持站点数据最新，把生成脚本接到 Pages 工作流上传前**

```yaml
      - name: Generate Site Data
        shell: pwsh
        run: ./scripts/generate-site-data.ps1

      - name: Upload Pages Artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: site
```

- [ ] **Step 3: 验证 README 中的命令和工作流引用存在**

Run:

```powershell
rg -n "generate-site-data.ps1|showcase.json|cover.png" README.md .github/workflows/deploy-pages.yml
```

Expected: README 至少出现一次生成命令；如果接了工作流，`deploy-pages.yml` 中也应出现脚本调用。

- [ ] **Step 4: Commit**

```bash
git add README.md .github/workflows/deploy-pages.yml
git commit -m "docs: document showcase metadata workflow"
```

### Task 6: 端到端验证

**Files:**
- Verify: `themes/*`
- Verify: `scripts/generate-site-data.ps1`
- Verify: `site/index.html`
- Verify: `site/assets/site.css`
- Verify: `site/assets/site.js`
- Verify: `site/assets/data/themes.json`

- [ ] **Step 1: 重新生成展示数据**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-site-data.ps1
```

Expected: 成功退出，无未处理异常。

- [ ] **Step 2: 检查生成数据中三种状态是否都可被表示**

Run:

```powershell
([System.IO.File]::ReadAllText('site/assets/data/themes.json', [System.Text.Encoding]::UTF8) | ConvertFrom-Json) | ForEach-Object {
  [PSCustomObject]@{
    id = $_.id
    hasCover = -not [string]::IsNullOrWhiteSpace([string]$_.coverImage)
    featureCount = @($_.features).Count
    parameterCount = @($_.parameters).Count
  }
}
```

Expected: 三个主题都有 `id`，至少一个主题如果提供了 `cover.png` 则 `hasCover = True`，其余主题仍有 `featureCount` 与 `parameterCount`。

- [ ] **Step 3: 本地预览站点并做人工检查**

Run:

```powershell
Set-Location site
python -m http.server 4173
```

Expected: 在浏览器访问 `http://localhost:4173` 时，能看到参考稿风格首页、主题列表、安装区和页脚，下载链接可点击，移动端缩窄窗口后不破版。

- [ ] **Step 4: 检查最终工作区状态**

Run:

```powershell
git status --short
```

Expected: 只有本任务相关文件变更；确认没有意外漏生成或多余产物。

- [ ] **Step 5: Commit**

```bash
git add themes scripts site README.md .github/workflows
git commit -m "feat: rebuild theme showcase pipeline and homepage"
```
