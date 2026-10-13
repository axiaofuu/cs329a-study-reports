#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const strict = args.includes('--strict');
const filename = args.find((arg) => !arg.startsWith('--'));

if (!filename) {
  console.error('Usage: node lint-report.mjs <src/index.html> [--strict] [--json]');
  process.exit(2);
}

let html;
try {
  html = fs.readFileSync(filename, 'utf8');
} catch (error) {
  console.error(`Cannot read ${filename}: ${error.message}`);
  process.exit(2);
}

const issues = [];
const add = (severity, rule, index, message, suggestion = '') => {
  const line = html.slice(0, Math.max(0, index)).split('\n').length;
  const excerpt = html.slice(index, index + 180).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  issues.push({ severity, rule, line, excerpt, message, suggestion });
};
const error = (rule, index, message, suggestion) => add('error', rule, index, message, suggestion);
const warn = (rule, index, message, suggestion) => add('warning', rule, index, message, suggestion);
const count = (re, text = html) => [...text.matchAll(re)].length;
const strip = (value) => value
  .replace(/<script\b[\s\S]*?<\/script>/gi, '')
  .replace(/<style\b[\s\S]*?<\/style>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z#0-9]+;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

for (const id of ['source-note', 'map', 'corrections', 'quiz', 'transcript', 'sources']) {
  if (!new RegExp(`id=["']${id}["']`).test(html)) {
    error('SECTION_MISSING', 0, `缺少 #${id} 固定章节。`, '按内容模板补齐固定章节。');
  }
}

const mapCards = count(/class=["'][^"']*\bmap-card\b[^"']*["']/g);
if (mapCards < 3 || mapCards > 6) {
  error('MAP_CARD_COUNT', html.indexOf('id="map"'), `知识地图应有 3–6 张卡片，当前为 ${mapCards}。`);
}

const blockStarts = [...html.matchAll(/<section\b[^>]*id=["']block-\d+["'][^>]*>/g)];
if (blockStarts.length < 3 || blockStarts.length > 6) {
  error('BLOCK_COUNT', 0, `知识块应为 3–6 个，当前为 ${blockStarts.length}。`);
}
for (let i = 0; i < blockStarts.length; i++) {
  const start = blockStarts[i].index;
  const end = blockStarts[i + 1]?.index ?? html.indexOf('<section', start + blockStarts[i][0].length);
  const block = html.slice(start, end > start ? end : html.length);
  const name = blockStarts[i][0].match(/id=["']([^"']+)/)?.[1] ?? `block-${i + 1}`;
  if (!/class=["'][^"']*\blead\b/.test(block)) error('BLOCK_LEAD_MISSING', start, `${name} 缺少白话导语。`);
  const steps = count(/class=["'][^"']*\bpage-step\b/g, block);
  if (steps < 3) error('PAGE_STEP_COUNT', start, `${name} 至少需要 3 个按页讲解，当前为 ${steps}。`);
  if (!/<figure\b|class=["'][^"']*\bformula\b/.test(block)) error('BLOCK_EVIDENCE_MISSING', start, `${name} 缺少投影片或公式。`);
  if (!/class=["'][^"']*\bcallout\b/.test(block)) error('BLOCK_LIMIT_MISSING', start, `${name} 缺少边界条件或工程限制。`);
}

for (const match of html.matchAll(/<figure\b[\s\S]*?<\/figure>/g)) {
  const figure = match[0];
  const alt = figure.match(/<img\b[^>]*alt=["']([^"']*)["']/i)?.[1]?.trim();
  if (!alt) error('IMAGE_ALT_MISSING', match.index, '投影片图片缺少非空 alt。');
  const caption = strip(figure.match(/<figcaption\b[\s\S]*?<\/figcaption>/i)?.[0] ?? '');
  if (!caption) error('FIGCAPTION_MISSING', match.index, '投影片图片缺少说明文字。');
  if (caption && !/(?:约\s*)?p\d+/i.test(caption)) warn('FIGCAPTION_PAGE_MISSING', match.index, '图注未标明投影片页码。');
  if (caption && !/\d{2}:\d{2}/.test(caption)) warn('FIGCAPTION_TIME_MISSING', match.index, '图注未标明视频时间。');
}

for (const match of html.matchAll(/<div\b[^>]*class=["'][^"']*\bformula\b[^"']*["'][^>]*>[\s\S]*?<\/div>/g)) {
  const explanation = strip(match[0].match(/<small\b[\s\S]*?<\/small>/i)?.[0] ?? '');
  if (!explanation) {
    error('FORMULA_EXPLANATION_MISSING', match.index, '公式缺少白话解释。');
    continue;
  }
  if (!/(公式|计算|表达|差距)/.test(explanation)) warn('FORMULA_PURPOSE_MISSING', match.index, '公式解释没有先说明它用来做什么。');
  if (!/\d/.test(explanation)) warn('FORMULA_EXAMPLE_MISSING', match.index, '公式解释没有数字或具体动作例子。');
  if (!/(前提|若|如果|只有|不能|无效|失效|不是)/.test(explanation)) warn('FORMULA_LIMIT_MISSING', match.index, '公式解释没有写成立条件或不能推出的结论。');
}

const questionCount = count(/class=["'][^"']*\bquestion\b/g);
if (questionCount < 6 || questionCount > 10) {
  error('QUIZ_COUNT', html.indexOf('id="quiz"'), `测试题应为 6–10 道，当前为 ${questionCount}。`);
}
const answerLeak = /data-answer|answerKey|correctAnswer|scoreQuiz|<input\b[^>]*\bchecked(?:\s|=|>)/i.exec(html);
if (answerLeak) error('ANSWER_LEAK', answerLeak.index, 'HTML 或 JavaScript 中出现答案键、评分逻辑或默认选中项。');

const forbidden = ['赋能', '抓手', '范式升级', '形成闭环', '打通链路', '能力跃迁', '端到端提效', '实现质的飞跃', '众所周知', '容易看出'];
for (const word of forbidden) {
  let from = 0;
  while ((from = html.indexOf(word, from)) !== -1) {
    warn('FORBIDDEN_PHRASE', from, `出现高风险空泛表达“${word}”。`, '改写成谁做什么、结果怎样。');
    from += word.length;
  }
}

const proseRegion = html
  .replace(/<section\b[^>]*id=["']transcript["'][\s\S]*?<\/section>/i, '')
  .replace(/<section\b[^>]*id=["']sources["'][\s\S]*?<\/section>/i, '')
  .replace(/<section\b[^>]*id=["']corrections["'][\s\S]*?<\/section>/i, '');

for (const match of proseRegion.matchAll(/<(p|figcaption)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
  const text = strip(match[2]);
  if (!text) continue;
  if ([...text].length > 260) warn('PARAGRAPH_TOO_LONG', match.index, `段落长度为 ${[...text].length} 字符。`, '拆成 2–3 个只承担一个判断的段落。');
  for (const sentence of text.split(/[。！？；]/).map((x) => x.trim()).filter(Boolean)) {
    if ([...sentence].length > 90) {
      warn('SENTENCE_TOO_LONG', match.index, `句子长度为 ${[...sentence].length} 字符。`, '拆句，并把例子放在结论之后。');
      break;
    }
  }
  const jargon = ['oracle', 'coverage', 'selector', 'fuser', 'verifier', 'beam search', 'scaling law', '搜索宽度', '搜索深度', '泛化', '鲁棒'];
  const hits = jargon.filter((term) => text.toLowerCase().includes(term.toLowerCase()));
  if (hits.length > 2) warn('JARGON_DENSITY', match.index, `同一段出现多个术语：${hits.join('、')}。`, '先解释动作，再在首次出现处补术语。');
}

for (const match of html.matchAll(/(?:href|src)=["'](\.\.?\/[^"'#?]+)["']/g)) {
  const target = path.resolve(path.dirname(filename), match[1]);
  if (!fs.existsSync(target)) error('LOCAL_LINK_MISSING', match.index, `本地文件不存在：${match[1]}`);
}

const unexpectedTemplate = /\{\{(?!TRANSCRIPT\}\}|GENERATED_AT\}\})[^}]+\}\}/.exec(html);
if (unexpectedTemplate) error('TEMPLATE_TOKEN_LEFT', unexpectedTemplate.index, `存在未声明模板变量：${unexpectedTemplate[0]}`);

const errors = issues.filter((issue) => issue.severity === 'error').length;
const warnings = issues.filter((issue) => issue.severity === 'warning').length;
const result = { file: path.resolve(filename), errors, warnings, issues };

if (jsonMode) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('CS329A report check\n');
  for (const issue of issues) {
    console.log(`${issue.severity === 'error' ? 'ERROR' : 'WARN'} ${issue.rule}`);
    console.log(`  ${filename}:${issue.line}`);
    console.log(`  ${issue.message}`);
    if (issue.excerpt) console.log(`  “${issue.excerpt.slice(0, 140)}”`);
    if (issue.suggestion) console.log(`  建议：${issue.suggestion}`);
    console.log('');
  }
  console.log(`Result: ${errors} errors, ${warnings} warnings`);
}

process.exit(errors > 0 || (strict && warnings > 0) ? 1 : 0);
