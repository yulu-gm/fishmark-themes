(function () {
  const releaseBaseUrl =
    "https://github.com/yulu-gm/yora-themes/releases/latest/download/";
  const repositoryBaseUrl = "https://github.com/yulu-gm/yora-themes/tree/main/themes/";
  const fallbackThemes = [
    {
      id: "ember-ascend",
      name: "Ember Ascend",
      version: "1.0.0",
      modes: ["dark"],
      tagline: "余烬从工作区中央慢慢上升，适合专注写作与深色阅读。",
      summary:
        "以暗场背景承接高热度中心光束，让正文像从低照度舞台里浮现出来。适合夜间写作、长段落聚焦和需要强烈视觉中心的界面偏好。",
      features: ["暗色专用", "动态余烬背景", "色温可调", "呼吸动画可关"],
      parameters: ["余烬强度", "色温", "上升呼吸", "工作区毛玻璃"],
      coverImage: null,
      accentStart: "#ff934f",
      accentEnd: "#7a2310",
      surface:
        "radial-gradient(circle at 50% 28%, rgba(255, 183, 77, 0.9), rgba(122, 35, 16, 0) 52%), linear-gradient(180deg, #140d0c 0%, #2f1208 54%, #0f0909 100%)",
      downloadFile: "ember-ascend-1.0.0.zip"
    },
    {
      id: "pearl-drift",
      name: "Pearl Drift",
      version: "1.0.0",
      modes: ["light", "dark"],
      tagline: "珍珠感的虹彩与雾面玻璃壳层，适合日夜双模切换。",
      summary:
        "把工作区做成轻盈的半透明珍珠壳层，让侧栏、设置面板和正文表面保持统一的 nacre 质感。适合需要双模式兼容、但不想丢掉氛围感的主题使用者。",
      features: ["双模式", "虹彩动态背景", "柔雾玻璃工作区", "参数观感克制"],
      parameters: ["虹彩强度", "流动速度", "颗粒感", "工作区毛玻璃"],
      coverImage: null,
      accentStart: "#d9d4ff",
      accentEnd: "#6b68d4",
      surface:
        "radial-gradient(circle at 28% 22%, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0) 34%), radial-gradient(circle at 72% 28%, rgba(154, 151, 234, 0.7), rgba(154, 151, 234, 0) 36%), linear-gradient(135deg, #f8f3ff 0%, #d9d4ff 48%, #b7d5da 100%)",
      downloadFile: "pearl-drift-1.0.0.zip"
    },
    {
      id: "rain-glass",
      name: "Rain Glass",
      version: "2.0.0",
      modes: ["light", "dark"],
      tagline: "雨窗折射、冷雾玻璃和偶发闪电，气氛最完整的一套主题。",
      summary:
        "把整套工作区变成一面被雨水覆盖的玻璃窗。它同时带有纹理贴图、工作区玻璃、标题栏背板和多组动态参数，是目前最完整的一套氛围型主题。",
      features: ["双模式", "贴图驱动雨窗背景", "标题栏动态背板", "多参数可调"],
      parameters: ["雨量", "玻璃模糊", "工作区毛玻璃", "闪电效果", "镜头呼吸", "冷色调强度"],
      coverImage: "./assets/generated/covers/rain-glass.png",
      accentStart: "#a4d8ff",
      accentEnd: "#22577a",
      surface:
        "radial-gradient(circle at 22% 20%, rgba(164, 216, 255, 0.28), transparent 40%), linear-gradient(180deg, rgba(13, 27, 42, 0.9) 0%, rgba(15, 39, 64, 0.92) 100%)",
      downloadFile: "rain-glass-2.0.0.zip"
    }
  ];

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function renderFeatureTags(items) {
    return items
      .map((item) => `<span class="feature-tag">${escapeHtml(item)}</span>`)
      .join("");
  }

  function renderParamTags(items) {
    return items
      .map((item) => `<span class="param-chip">${escapeHtml(item)}</span>`)
      .join("");
  }

  function renderModeBadges(modes) {
    return modes
      .map((mode) => {
        const className = mode === "dark" ? "dark" : "light";
        const label = mode === "dark" ? "Dark" : "Light";
        return `<span class="mode-badge ${className}">${label}</span>`;
      })
      .join("");
  }

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
          <div class="mock-titlebar">
            <span class="mock-dot r"></span>
            <span class="mock-dot y"></span>
            <span class="mock-dot g"></span>
          </div>
          <div class="mock-editor-body">
            <div class="mock-line h1"></div>
            <div class="mock-line xlong"></div>
            <div class="mock-line long"></div>
            <div class="mock-line med"></div>
            <div class="mock-line h2"></div>
            <div class="mock-line xlong"></div>
            <div class="mock-line long"></div>
            <div class="mock-line short"></div>
            <div class="mock-line med"></div>
            <div class="mock-line xlong"></div>
            <div class="mock-line long"></div>
          </div>
        </div>
      </div>
    `;
  }

  function renderThemeCard(theme, index) {
    const reverseClass = index % 2 === 1 ? " is-reverse" : "";
    const downloadUrl = `${releaseBaseUrl}${encodeURIComponent(theme.downloadFile)}`;
    const sourceUrl = `${repositoryBaseUrl}${encodeURIComponent(theme.id)}`;
    const features = Array.isArray(theme.features) ? theme.features : [];
    const parameters = Array.isArray(theme.parameters) ? theme.parameters : [];
    const modes = Array.isArray(theme.modes) ? theme.modes : [];

    return `
      <article class="theme-card${reverseClass}">
        ${renderPreview(theme)}
        <div class="theme-info">
          <div class="theme-meta">
            <span class="theme-version">v${escapeHtml(theme.version)}</span>
            <div class="theme-modes">${renderModeBadges(modes)}</div>
          </div>
          <h3>${escapeHtml(theme.name)}</h3>
          <p class="theme-tagline">${escapeHtml(theme.tagline || "")}</p>
          ${theme.summary ? `<p class="theme-summary">${escapeHtml(theme.summary)}</p>` : ""}
          ${features.length > 0 ? `<div class="theme-features">${renderFeatureTags(features)}</div>` : ""}
          ${
            parameters.length > 0
              ? `<div class="theme-params"><p class="params-label">可调参数</p><div class="params-list">${renderParamTags(
                  parameters
                )}</div></div>`
              : ""
          }
          <div class="theme-actions">
            <a
              class="btn-download"
              href="${downloadUrl}"
              style="background:linear-gradient(135deg, ${escapeHtml(theme.accentStart)}, ${escapeHtml(theme.accentEnd)})"
            >
              ↓ 下载 ZIP
            </a>
            <a class="btn-details" href="${sourceUrl}" target="_blank" rel="noreferrer">查看源码</a>
          </div>
        </div>
      </article>
    `;
  }

  async function loadThemes() {
    try {
      const response = await fetch("./assets/data/themes.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }

      throw new Error("themes.json is empty.");
    } catch (error) {
      console.warn("Failed to load themes.json, using fallback data instead.", error);
      return fallbackThemes;
    }
  }

  async function main() {
    const grid = document.querySelector("#theme-grid");
    if (!grid) {
      return;
    }

    const themes = await loadThemes();
    grid.innerHTML = themes.map(renderThemeCard).join("");
  }

  void main();
})();
