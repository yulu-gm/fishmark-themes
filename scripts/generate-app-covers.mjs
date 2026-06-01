import { spawn } from "node:child_process";
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const themesRoot = path.join(repoRoot, "themes");
const defaultFishMarkRoot = path.resolve(repoRoot, "..", "FishMark");
const require = createRequire(import.meta.url);

const capturePlans = [
  { id: "ember-ascend", mode: "dark" },
  { id: "pearl-drift", mode: "light" },
  { id: "rain-glass", mode: "dark" },
  { id: "sakura-cat", mode: "light" }
];

const sampleMarkdown = `# Theme Cover Notes

FishMark keeps Markdown as the source of truth while the editor stays calm, local, and fast.

> A good theme should support long writing sessions without stealing focus from the words.

- Smooth single-column editing
- Local-first files
- Round-trip Markdown safety

\`\`\`ts
type ThemeCover = {
  source: "real-app";
  renderer: "Electron";
  verified: true;
};
\`\`\`

| Theme surface | Purpose |
| --- | --- |
| Tokens | Color and typography slots |
| Editor | Writing flow |
| Markdown | Reading geometry |
`;

function parseArguments(argv) {
  const options = {
    fishmarkRoot: process.env.FISHMARK_APP_ROOT || defaultFishMarkRoot,
    keepTemp: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--fishmark-root") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--fishmark-root requires a path.");
      }

      options.fishmarkRoot = path.resolve(value);
      index += 1;
      continue;
    }

    if (arg === "--keep-temp") {
      options.keepTemp = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function findAvailablePort(startPort) {
  for (let offset = 0; offset < 100; offset += 1) {
    const candidate = startPort + offset;
    const available = await new Promise((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => {
        server.close(() => resolve(true));
      });
      server.listen(candidate, "127.0.0.1");
    });

    if (available) {
      return candidate;
    }
  }

  throw new Error(`No available port found from ${startPort}.`);
}

async function wait(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchJsonWithRetry(url, timeoutMs = 15_000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }

      lastError = new Error(`HTTP ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }

    await wait(250);
  }

  throw lastError ?? new Error(`Timed out fetching ${url}`);
}

async function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 1;

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) {
      return;
    }

    const callbacks = pending.get(message.id);
    if (!callbacks) {
      return;
    }

    pending.delete(message.id);
    if (message.error) {
      callbacks.reject(new Error(message.error.message ?? JSON.stringify(message.error)));
      return;
    }

    callbacks.resolve(message.result);
  });

  return {
    send(method, params = {}) {
      const id = nextId;
      nextId += 1;

      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    }
  };
}

function createPreferences(themeId, mode) {
  return {
    version: 3,
    autosave: {
      idleDelayMs: 1000
    },
    recentFiles: {
      maxEntries: 10
    },
    ui: {
      fontFamily: null,
      fontSize: null
    },
    document: {
      fontFamily: null,
      cjkFontFamily: null,
      fontSize: null
    },
    images: {
      temporaryDirectory: null
    },
    theme: {
      mode,
      selectedId: themeId,
      effectsMode: "full",
      parameters: {}
    }
  };
}

function resolveDevUserDataRoot() {
  const appDataRoot = process.env.APPDATA;
  if (!appDataRoot) {
    throw new Error("APPDATA is not defined; cannot resolve FishMark-dev userData.");
  }

  return path.join(appDataRoot, "FishMark-dev");
}

async function prepareUserData(userDataRoot) {
  const targetThemesRoot = path.join(userDataRoot, "themes");
  await mkdir(targetThemesRoot, { recursive: true });

  for (const plan of capturePlans) {
    const source = path.join(themesRoot, plan.id);
    const target = path.join(targetThemesRoot, plan.id);
    if (!existsSync(source)) {
      throw new Error(`Theme directory not found: ${source}`);
    }

    await rm(target, { recursive: true, force: true });
    await cp(source, target, { recursive: true });
  }

  return { userDataRoot };
}

async function writeThemePreferences(userDataRoot, plan) {
  await writeFile(
    path.join(userDataRoot, "preferences.json"),
    `${JSON.stringify(createPreferences(plan.id, plan.mode), null, 2)}\n`,
    "utf8"
  );
}

async function backupUserDataFiles(userDataRoot) {
  const fileNames = ["preferences.json", "recent-files.json"];
  const backups = new Map();

  for (const fileName of fileNames) {
    const filePath = path.join(userDataRoot, fileName);
    try {
      backups.set(filePath, await readFile(filePath));
    } catch {
      backups.set(filePath, null);
    }
  }

  return backups;
}

async function restoreUserDataFiles(backups) {
  for (const [filePath, content] of backups) {
    if (content === null) {
      await rm(filePath, { force: true });
      continue;
    }

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }
}

function getElectronBinary(fishmarkRoot) {
  const electronEntry = path.join(fishmarkRoot, "node_modules", "electron");
  return require(electronEntry);
}

async function waitForPageTarget(port) {
  const startedAt = Date.now();
  let targets = [];

  while (Date.now() - startedAt < 20_000) {
    targets = await fetchJsonWithRetry(`http://127.0.0.1:${port}/json/list`);
    const pageTarget = targets.find((target) => {
      return target.type === "page" && typeof target.webSocketDebuggerUrl === "string";
    });

    if (pageTarget) {
      return pageTarget;
    }

    await wait(250);
  }

  throw new Error(`No page target exposed on DevTools port ${port}: ${JSON.stringify(targets, null, 2)}`);
}

async function waitForThemeReady(cdp, plan) {
  const expression = `(() => {
    const links = Array.from(document.querySelectorAll('link[data-fishmark-theme-runtime="active"]')).map((link) => link.href);
    const bodyText = document.body?.innerText ?? "";
    const themeMode = document.documentElement.getAttribute("data-fishmark-theme");
    const runtimeMode = document.documentElement.getAttribute("data-fishmark-theme-mode");
    const editor = document.querySelector(".document-editor");
    const ready = Boolean(
      editor &&
      bodyText.includes("Theme Cover Notes") &&
      links.some((href) => href.includes("${plan.id}")) &&
      themeMode === "${plan.mode}" &&
      runtimeMode === "${plan.mode}"
    );

    return {
      ready,
      themeMode,
      runtimeMode,
      linkCount: links.length,
      links,
      textPreview: bodyText.slice(0, 240)
    };
  })()`;
  const startedAt = Date.now();
  let latest = null;

  while (Date.now() - startedAt < 20_000) {
    const result = await cdp.send("Runtime.evaluate", {
      expression,
      awaitPromise: false,
      returnByValue: true
    });
    latest = result.result?.value;

    if (latest?.ready) {
      return latest;
    }

    await wait(300);
  }

  throw new Error(`Timed out waiting for theme ${plan.id}: ${JSON.stringify(latest, null, 2)}`);
}

async function captureTheme(input) {
  const { fishmarkRoot, samplePath, plan } = input;
  const port = await findAvailablePort(9300);
  const electronBinary = getElectronBinary(fishmarkRoot);
  const rendererUrl = pathToFileURL(path.join(fishmarkRoot, "dist", "index.html")).toString();
  const child = spawn(
    electronBinary,
    [`--remote-debugging-port=${port}`, fishmarkRoot, samplePath],
    {
      cwd: fishmarkRoot,
      env: {
      ...process.env,
        VITE_DEV_SERVER_URL: rendererUrl,
        ELECTRON_DISABLE_SECURITY_WARNINGS: "true"
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  let cdp = null;
  try {
    const target = await waitForPageTarget(port);
    cdp = await connectCdp(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await waitForThemeReady(cdp, plan);
    await wait(1_500);
    const screenshot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false
    });
    const coverPath = path.join(themesRoot, plan.id, "cover.png");
    await writeFile(coverPath, Buffer.from(screenshot.data, "base64"));
    return { coverPath };
  } catch (error) {
    const detail = [
      error instanceof Error ? error.message : String(error),
      stdout.trim() ? `stdout:\n${stdout.trim()}` : "",
      stderr.trim() ? `stderr:\n${stderr.trim()}` : ""
    ].filter(Boolean).join("\n\n");
    throw new Error(detail);
  } finally {
    cdp?.close();
    if (!child.killed) {
      child.kill();
    }

    await new Promise((resolve) => {
      child.once("exit", resolve);
      setTimeout(resolve, 1_000);
    });
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const fishmarkRoot = path.resolve(options.fishmarkRoot);
  const requiredPaths = [
    path.join(fishmarkRoot, "dist", "index.html"),
    path.join(fishmarkRoot, "dist-electron", "main", "main.js"),
    path.join(fishmarkRoot, "node_modules", "electron")
  ];

  for (const requiredPath of requiredPaths) {
    if (!(await pathExists(requiredPath))) {
      throw new Error(
        `Required FishMark build artifact not found: ${requiredPath}\nRun npm.cmd run build in ${fishmarkRoot} first.`
      );
    }
  }

  const tempRoot = await fsMkTemp(path.join(os.tmpdir(), "fishmark-theme-covers-"));
  const userDataRoot = resolveDevUserDataRoot();
  const backups = await backupUserDataFiles(userDataRoot);
  await prepareUserData(userDataRoot);
  const samplePath = path.join(tempRoot, "theme-cover-sample.md");
  await writeFile(samplePath, sampleMarkdown, "utf8");

  try {
    for (const plan of capturePlans) {
      await writeThemePreferences(userDataRoot, plan);
      process.stdout.write(`Capturing ${plan.id} (${plan.mode})...\n`);
      const result = await captureTheme({
        fishmarkRoot,
        samplePath,
        plan
      });
      process.stdout.write(`Wrote ${result.coverPath}\n`);
    }
  } finally {
    await restoreUserDataFiles(backups);
    if (options.keepTemp) {
      process.stdout.write(`Kept temp directory: ${tempRoot}\n`);
    } else {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }
}

async function fsMkTemp(prefix) {
  const { mkdtemp } = await import("node:fs/promises");
  return await mkdtemp(prefix);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
