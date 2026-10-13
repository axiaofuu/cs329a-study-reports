#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
if (!args[0] || args.includes('--help')) {
  console.log('Usage: node tools/scan-codebase.mjs <repository> [output.json]');
  process.exit(args.includes('--help') ? 0 : 2);
}

const root = path.resolve(args[0]);
const output = path.resolve(args[1] ?? 'codebase-manifest.json');
if (!fs.statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`Repository directory not found: ${args[0]}`);
  process.exit(2);
}

const excludedDirs = new Set([
  '.git', '.hg', '.svn', 'node_modules', 'vendor', 'dist', 'build', 'coverage',
  '.next', '.nuxt', '.cache', 'target', '__pycache__', '.venv', 'venv', '.tox'
]);
const sensitiveNames = [
  /^\.env(?:\.|$)/i, /^(?:id_rsa|id_ed25519)(?:\.pub)?$/i,
  /cookies?/i, /credentials?/i, /secrets?/i, /\.pem$/i, /\.key$/i,
  /\.p12$/i, /\.pfx$/i
];
const languageByExt = new Map([
  ['.js', 'JavaScript'], ['.mjs', 'JavaScript'], ['.cjs', 'JavaScript'],
  ['.ts', 'TypeScript'], ['.tsx', 'TypeScript'], ['.jsx', 'JavaScript'],
  ['.py', 'Python'], ['.go', 'Go'], ['.rs', 'Rust'], ['.java', 'Java'],
  ['.kt', 'Kotlin'], ['.rb', 'Ruby'], ['.php', 'PHP'], ['.cs', 'C#'],
  ['.c', 'C'], ['.h', 'C/C++'], ['.cc', 'C++'], ['.cpp', 'C++'],
  ['.swift', 'Swift'], ['.scala', 'Scala'], ['.sh', 'Shell'], ['.sql', 'SQL'],
  ['.vue', 'Vue'], ['.svelte', 'Svelte']
]);
const manifestNames = new Set([
  'package.json', 'pyproject.toml', 'requirements.txt', 'Pipfile', 'poetry.lock',
  'go.mod', 'Cargo.toml', 'pom.xml', 'build.gradle', 'build.gradle.kts',
  'Gemfile', 'composer.json', 'Makefile', 'CMakeLists.txt', 'Dockerfile'
]);
const configPattern = /(^|\/)(?:config|configs|configuration)(\/|\.|$)|\.(?:ya?ml|toml|ini|conf)$/i;
const testPattern = /(^|\/)(?:test|tests|spec|specs|__tests__)(\/|$)|(?:\.test|\.spec)\.[^.]+$/i;
const roleRules = [
  [/\b(api|routes?|controllers?|handlers?)\b/i, '接收外部请求并分派处理'],
  [/\b(services?|usecases?|domain)\b/i, '实现核心业务流程'],
  [/\b(models?|entities?|schemas?)\b/i, '定义数据结构和领域对象'],
  [/\b(repositories?|dao|storage|database|db)\b/i, '读写持久化数据'],
  [/\b(adapters?|clients?|integrations?)\b/i, '连接外部系统'],
  [/\b(middleware|middlewares)\b/i, '在主流程前后执行横切处理'],
  [/\b(config|configs|configuration)\b/i, '加载和组织运行配置'],
  [/\b(utils?|helpers?|common|shared)\b/i, '提供跨模块复用能力'],
  [/\b(test|tests|spec|specs|__tests__)\b/i, '验证实现行为'],
  [/\b(cli|commands?|scripts?)\b/i, '提供命令行或自动化入口'],
];
const containerRoots = new Set(['src', 'lib', 'app', 'apps', 'packages', 'services', 'modules', 'cmd', 'internal', 'reports']);

const toPosix = (value) => value.split(path.sep).join('/');
const rel = (value) => toPosix(path.relative(root, value)) || '.';
const allFiles = [];
let skippedSensitiveFiles = 0;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (path.resolve(full) === output) continue;
    if (entry.isDirectory()) {
      if (!excludedDirs.has(entry.name)) walk(full);
      continue;
    }
    if (sensitiveNames.some((rule) => rule.test(entry.name))) {
      skippedSensitiveFiles++;
      continue;
    }
    allFiles.push(full);
  }
}
walk(root);

const sourcePaths = new Set(allFiles.map(rel));
const sourceExtensions = [...new Set(languageByExt.keys())];
const readText = (file) => {
  const stat = fs.statSync(file);
  if (stat.size > 1024 * 1024) return null;
  const buffer = fs.readFileSync(file);
  if (buffer.includes(0)) return null;
  return buffer.toString('utf8');
};

function lineAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

function extractImports(text, language) {
  const found = [];
  const addMatches = (regex, group = 1) => {
    for (const match of text.matchAll(regex)) found.push({ specifier: match[group], line: lineAt(text, match.index) });
  };
  if (language === 'JavaScript' || language === 'TypeScript' || language === 'Vue' || language === 'Svelte') {
    addMatches(/\bimport(?:[\s\S]*?\bfrom\s*)?["']([^"']+)["']/g);
    addMatches(/\brequire\(\s*["']([^"']+)["']\s*\)/g);
    addMatches(/\bimport\(\s*["']([^"']+)["']\s*\)/g);
  } else if (language === 'Python') {
    addMatches(/^\s*from\s+([.\w]+)\s+import\s+/gm);
    addMatches(/^\s*import\s+([\w.]+)/gm);
  } else if (language === 'Rust') {
    addMatches(/^\s*(?:use|mod)\s+([\w:]+)/gm);
  } else if (language === 'Go') {
    addMatches(/^\s*import\s+["']([^"']+)["']/gm);
    addMatches(/^\s*["']([^"']+)["']\s*$/gm);
  }
  return [...new Map(found.map((item) => [`${item.specifier}:${item.line}`, item])).values()];
}

function extractSymbols(text, language) {
  const patterns = [];
  if (language === 'JavaScript' || language === 'TypeScript') {
    patterns.push(['function', /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/gm]);
    patterns.push(['class', /^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/gm]);
    patterns.push(['function', /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/gm]);
  } else if (language === 'Python') {
    patterns.push(['function', /^(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/gm]);
    patterns.push(['class', /^class\s+([A-Za-z_]\w*)/gm]);
  } else if (language === 'Go') {
    patterns.push(['function', /^func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)\s*\(([^)]*)\)/gm]);
  } else if (language === 'Rust') {
    patterns.push(['function', /^(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/gm]);
  } else if (language === 'Java' || language === 'Kotlin' || language === 'C#') {
    patterns.push(['class', /\b(?:class|interface|object)\s+([A-Za-z_]\w*)/g]);
  }
  const symbols = [];
  for (const [kind, regex] of patterns) {
    for (const match of text.matchAll(regex)) {
      const signature = match[2] === undefined ? match[1] : `${match[1]}(${match[2].replace(/\s+/g, ' ').trim()})`;
      symbols.push({ kind, name: match[1], signature, line: lineAt(text, match.index) });
    }
  }
  return symbols.slice(0, 200);
}

function resolveLocalImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  const candidates = [base];
  for (const ext of sourceExtensions) candidates.push(`${base}${ext}`);
  for (const ext of sourceExtensions) candidates.push(`${base}/index${ext}`);
  return candidates.find((candidate) => sourcePaths.has(candidate)) ?? null;
}

const files = [];
for (const full of allFiles) {
  const file = rel(full);
  const ext = path.extname(file).toLowerCase();
  const language = languageByExt.get(ext);
  const isManifest = manifestNames.has(path.basename(file));
  const isConfig = isManifest || configPattern.test(file);
  if (!language && !isManifest && !isConfig && !/^README(?:\.|$)/i.test(path.basename(file))) continue;
  const text = readText(full);
  if (text === null) continue;
  const lineCount = text === '' ? 0 : text.split('\n').length;
  files.push({
    path: file,
    language: language ?? 'Configuration',
    lines: lineCount,
    isTest: testPattern.test(file),
    isConfig,
    imports: language ? extractImports(text, language) : [],
    symbols: language ? extractSymbols(text, language) : []
  });
}

const fileByPath = new Map(files.map((file) => [file.path, file]));
const dependencyEdges = [];
for (const file of files) {
  for (const item of file.imports) {
    const target = resolveLocalImport(file.path, item.specifier);
    dependencyEdges.push({
      from: file.path,
      to: target,
      specifier: item.specifier,
      line: item.line,
      type: target ? 'internal' : 'external-or-unresolved'
    });
  }
}

const modulesMap = new Map();
for (const file of files) {
  const parts = file.path.split('/');
  const modulePath = parts.length > 2 && containerRoots.has(parts[0])
    ? `${parts[0]}/${parts[1]}`
    : parts.length > 1 ? parts[0] : '(root)';
  if (!modulesMap.has(modulePath)) modulesMap.set(modulePath, []);
  modulesMap.get(modulePath).push(file);
}
const modules = [...modulesMap.entries()].map(([modulePath, moduleFiles]) => {
  const rule = roleRules.find(([regex]) => regex.test(modulePath));
  return {
    name: modulePath,
    path: modulePath,
    roleHint: rule?.[1] ?? '需要结合入口、依赖和实现确认职责',
    files: moduleFiles.map((file) => file.path),
    sourceFiles: moduleFiles.filter((file) => languageByExt.has(path.extname(file.path))).length,
    lines: moduleFiles.reduce((sum, file) => sum + file.lines, 0),
    symbols: moduleFiles.reduce((sum, file) => sum + file.symbols.length, 0)
  };
});

const manifests = files.filter((file) => manifestNames.has(path.basename(file.path))).map((file) => file.path);
const entrypoints = [];
const commands = {};
const addEntrypoint = (file, evidence) => {
  if (fileByPath.has(file) && !entrypoints.some((item) => item.file === file)) entrypoints.push({ file, evidence });
};
for (const candidate of ['src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js', 'index.js', 'main.py', 'app.py', 'manage.py', 'src/main.rs', 'cmd/main.go']) {
  addEntrypoint(candidate, 'conventional entrypoint filename');
}
for (const file of files) {
  if (file.path.endsWith('/__main__.py')) addEntrypoint(file.path, 'Python __main__ module');
  if (file.language === 'Go') {
    const text = readText(path.join(root, file.path));
    if (/\bpackage\s+main\b/.test(text) && /\bfunc\s+main\s*\(/.test(text)) addEntrypoint(file.path, 'Go main package');
  }
}
const packageFile = path.join(root, 'package.json');
if (fs.existsSync(packageFile)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
    for (const key of ['main', 'module']) if (typeof pkg[key] === 'string') addEntrypoint(pkg[key], `package.json ${key}`);
    if (typeof pkg.bin === 'string') addEntrypoint(pkg.bin, 'package.json bin');
    if (pkg.bin && typeof pkg.bin === 'object') for (const value of Object.values(pkg.bin)) if (typeof value === 'string') addEntrypoint(value, 'package.json bin');
    if (pkg.scripts && typeof pkg.scripts === 'object') {
      for (const [name, command] of Object.entries(pkg.scripts)) {
        if (typeof command !== 'string') continue;
        commands[name] = command;
        const nodeFile = command.match(/(?:^|\s)node\s+([^\s;&|]+)/)?.[1];
        if (nodeFile) addEntrypoint(nodeFile, `package.json script: ${name}`);
      }
    }
  } catch {}
}

const languageSummary = {};
for (const file of files) {
  languageSummary[file.language] ??= { files: 0, lines: 0 };
  languageSummary[file.language].files++;
  languageSummary[file.language].lines += file.lines;
}

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  project: {
    name: path.basename(root),
    root: '.',
    manifests,
    commands
  },
  summary: {
    files: files.length,
    sourceLines: files.reduce((sum, file) => sum + file.lines, 0),
    languages: languageSummary,
    internalDependencies: dependencyEdges.filter((edge) => edge.type === 'internal').length,
    externalOrUnresolvedDependencies: dependencyEdges.filter((edge) => edge.type !== 'internal').length
  },
  entrypoints,
  modules,
  files,
  dependencyEdges,
  skippedSensitiveFiles
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Codebase manifest written to ${path.relative(process.cwd(), output) || path.basename(output)}`);
console.log(`${files.length} files, ${modules.length} modules, ${dependencyEdges.length} dependency edges, ${skippedSensitiveFiles} sensitive files skipped.`);
