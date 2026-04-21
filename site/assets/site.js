(function () {
  const releaseBaseUrl =
    "https://github.com/yulu-gm/yulora-themes/releases/latest/download/";
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
      downloadFile: "ember-ascend-1.0.0.zip",
      accentStart: "#ff934f",
      accentEnd: "#7a2310",
      surface:
        "radial-gradient(circle at 50% 28%, rgba(255, 183, 77, 0.9), rgba(122, 35, 16, 0) 52%), linear-gradient(180deg, #140d0c 0%, #2f1208 54%, #0f0909 100%)"
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
      downloadFile: "pearl-drift-1.0.0.zip",
      accentStart: "#d9d4ff",
      accentEnd: "#6b68d4",
      surface:
        "radial-gradient(circle at 28% 22%, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0) 34%), radial-gradient(circle at 72% 28%, rgba(154, 151, 234, 0.7), rgba(154, 151, 234, 0) 36%), linear-gradient(135deg, #f8f3ff 0%, #d9d4ff 48%, #b7d5da 100%)"
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
      parameters: ["雨量", "玻璃模糊", "闪电效果", "镜头呼吸", "冷色调强度"],
      downloadFile: "rain-glass-2.0.0.zip",
      accentStart: "#a4d8ff",
      accentEnd: "#22577a",
      surface:
        "radial-gradient(circle at 22% 20%, rgba(164, 216, 255, 0.48), rgba(164, 216, 255, 0) 30%), linear-gradient(180deg, #0d1b2a 0%, #16324f 48%, #0f2740 100%)"
    }
  ];

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function createChipRow(items) {
    return items.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("");
  }

  function renderThemeCard(theme, index) {
    const downloadUrl = `${releaseBaseUrl}${encodeURIComponent(theme.downloadFile)}`;
    const modes = theme.modes.join(" / ");
    const badgeLabel = theme.modes.length === 1 ? "Single Mode" : "Dual Mode";

    return `
      <article class="theme-card" style="--theme-surface:${theme.surface};--accent:${theme.accentEnd};animation-delay:${index * 90}ms">
        <div class="theme-head">
          <div>
            <h3>${escapeHtml(theme.name)}</h3>
            <p class="theme-version">v${escapeHtml(theme.version)}</p>
          </div>
          <span class="theme-badge">${badgeLabel}</span>
        </div>
        <p class="theme-tagline">${escapeHtml(theme.tagline)}</p>
        <p class="theme-summary">${escapeHtml(theme.summary)}</p>
        <div>
          <p class="chip-label">亮点</p>
          <div class="chip-row">${createChipRow(theme.features)}</div>
        </div>
        <div>
          <p class="chip-label">参数</p>
          <div class="chip-row">${createChipRow(theme.parameters)}</div>
        </div>
        <div class="theme-footer">
          <p class="mode-line">支持模式：${escapeHtml(modes)}</p>
          <a class="theme-download" href="${downloadUrl}">下载 ${escapeHtml(theme.name)}</a>
        </div>
      </article>
    `;
  }

  async function loadThemes() {
    if (window.location.protocol === "file:") {
      return fallbackThemes;
    }

    try {
      const response = await fetch("./assets/data/themes.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
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
