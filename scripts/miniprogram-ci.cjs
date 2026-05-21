const fs = require("node:fs");
const path = require("node:path");
const ci = require("miniprogram-ci");
const esbuild = require("esbuild");

function emit(type, payload) {
  process.stdout.write(`${JSON.stringify({ type, payload })}\n`);
}

function stringify(value) {
  const seen = new WeakSet();
  try {
    return JSON.stringify(value, (_key, item) => {
      if (!item || typeof item !== "object") return item;
      if (seen.has(item)) return "[Circular]";
      seen.add(item);
      return item;
    });
  } catch {
    return String(value);
  }
}

function serializeError(error) {
  if (!error || typeof error !== "object") return { message: String(error) };
  const result = {
    name: error.name || "Error",
    message: error.message || stringify(error)
  };
  for (const key of Object.getOwnPropertyNames(error)) {
    result[key] = error[key];
  }
  if (result.message.includes("[object Object]")) {
    result.raw = stringify(result);
  }
  return result;
}

function isSkippableDir(name) {
  return name === "node_modules" || name === ".git";
}

function collectJsFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!isSkippableDir(entry.name)) collectJsFiles(entryPath, files);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".js")) files.push(entryPath);
  }
  return files;
}

function transpileProjectJs(projectPath) {
  const files = collectJsFiles(projectPath);
  let changed = 0;
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const result = esbuild.transformSync(source, {
      target: "es2018",
      platform: "browser",
      minify: false,
      legalComments: "none"
    });
    if (result.code !== source) {
      fs.writeFileSync(file, result.code);
      changed += 1;
    }
  }
  emit("progress", {
    id: "compat-transform",
    status: "done",
    message: `JS 兼容转译完成：${changed}/${files.length} 个文件`
  });
}

async function main() {
  const configPath = process.argv[2];
  if (!configPath) throw new Error("缺少上传配置文件");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  transpileProjectJs(config.projectPath);

  const project = new ci.Project({
    appid: config.appid,
    type: "miniProgram",
    projectPath: config.projectPath,
    privateKeyPath: config.privateKeyPath || undefined,
    privateKey: config.privateKeyContent || undefined,
    ignores: ["node_modules/**/*"]
  });

  await ci.upload({
    project,
    version: config.version,
    desc: config.desc,
    robot: 1,
    allowIgnoreUnusedFiles: false,
    setting: {
      useProjectConfig: false,
      es6: false,
      es7: false,
      minify: false,
      minifyJS: false,
      minifyWXML: false,
      minifyWXSS: false,
      autoPrefixWXSS: false,
      compileWorklet: false,
      enhance: false,
      swc: false,
      useCompilerPlugins: false
    },
    onProgressUpdate: (event) => emit("progress", event)
  });

  emit("done", {});
}

main().catch((error) => {
  emit("error", serializeError(error));
  process.exitCode = 1;
});
