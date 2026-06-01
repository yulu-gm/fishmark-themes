# FishMark Themes

FishMark 官方主题展示与下载仓库。

当前收录主题：

- `Ember Ascend`
- `Pearl Drift`
- `Rain Glass`
- `Sakura Cat`

## 仓库内容

- `themes/`
  主题包源码与各主题自己的展示元数据
- `site/`
  GitHub Pages 展示页源码
- `scripts/package-themes.ps1`
  本地与 CI 共用的主题打包脚本
- `scripts/generate-site-data.ps1`
  从 `themes/*` 自动汇总站点展示数据与封面图产物
- `.github/workflows/`
  Pages 部署与 Release 打包工作流

## 安装方式

1. 打开 FishMark 的主题目录 `<userData>/themes/`
2. 从 GitHub Releases 下载目标主题 zip
3. 解压后确认目录结构为 `<themeId>/manifest.json`
4. 回到 FishMark 设置页，点击“刷新主题”

## 主题列表

### Ember Ascend

- 模式：`dark`
- 关键词：余烬、热浪、暗场聚焦
- 亮点参数：余烬强度、色温、上升呼吸、工作区毛玻璃

### Pearl Drift

- 模式：`light` / `dark`
- 关键词：虹彩珍珠、雾面玻璃、柔和高亮
- 亮点参数：虹彩强度、流动速度、颗粒感、工作区毛玻璃

### Rain Glass

- 模式：`light` / `dark`
- 关键词：雨窗、冷雾、玻璃折射
- 亮点参数：雨量、玻璃模糊、闪电效果、镜头呼吸、冷色调强度

### Sakura Cat

- 模式：`light` / `dark`
- 关键词：樱花、奶油粉、柔和双模
- 亮点参数：无可调参数，静态轻量主题

## 展示页数据维护

每个主题目录可以按固定文件名提供展示数据：

- `manifest.json`
  必需，主题正式元数据
- `showcase.json`
  可选，展示页文案、标签、强调色与回退背景
- `cover.png`
  可选，固定命名封面图。存在时主页优先直接展示图片

推荐目录示例：

```text
themes/pearl-drift/
  manifest.json
  showcase.json
  cover.png
  tokens/
  styles/
  shaders/
```

如果没有 `cover.png`，主页会根据 `showcase.json` 或缺省规则自动生成展示卡片。

刷新站点展示数据：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-site-data.ps1
```

脚本会自动：

1. 扫描 `themes/*/manifest.json`
2. 读取同目录下可选的 `showcase.json`
3. 检测固定文件名 `cover.png`
4. 复制封面图到 `site/assets/generated/covers/`
5. 生成 `site/assets/data/themes.json`

## 本地打包

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-themes.ps1
```

打包完成后，压缩包会输出到 `dist/`。

## GitHub Pages

展示页源码位于 `site/`。建议通过 GitHub Actions 部署，而不是直接依赖 `docs/` 分支模式。

如果修改了 `themes/` 下的展示元数据或封面图，部署前请先运行 `generate-site-data.ps1`，确保 `site/` 下的产物已刷新。

## Release

`release-themes.yml` 会在 tag 推送或手动触发时打包 `themes/` 下的主题 zip 并上传到 GitHub Release。
