# Study Report Engine

把复杂材料转换成可检索、可验证、能直接学习的中文 HTML 报告。当前包含两个 profile：课程学习和代码库阅读。CS329A 是第一个完整示例。

> 非 Stanford 官方项目。课程、视频、投影片和论文版权归原作者及权利人。

<p align="center">
  <img src="./docs/pipeline.svg" width="100%" alt="CS329A course report generation pipeline">
</p>

## Shared architecture

```text
Source adapters
  → Evidence extraction
  → Evidence graph
  → Explanation profile
  → HTML renderer
  → Quality gates
  → Standalone report
```

| 层 | 课程 profile | 代码库 profile | 共享输出 |
|---|---|---|---|
| 输入适配 | 官网、视频、字幕、论文 | 源码、文档、配置、测试 | 原始材料清单 |
| 证据提取 | 时间戳、投影片、公式 | 导入、符号、入口、配置 | 位置明确的证据 |
| 证据图 | 时间—页码—论文 | 文件—模块—调用链 | 可追溯关系图 |
| 解释模板 | 知识块、逐页讲解 | 模块、输入输出、实现步骤 | 结构化正文 |
| 构建与检查 | HTML、可读性、移动端 | HTML、引用、隐私、完整性 | 独立 HTML 报告 |

## Course profile pipeline

1. 核验课程官网、视频日期、论文版本和讲义状态。
2. 并行处理字幕、投影片和论文证据。
3. 建立“视频时间—投影片页码—论文位置”映射。
4. 按课堂逻辑划分知识块，先解释直觉，再补专业术语。
5. 构建包含图片、逐字稿和测试题的独立 HTML。
6. 检查事实边界、语言可读性、链接、移动端和交互。

## Reports

| Part | Topic | Report |
|---|---|---|
| 2 | Test-Time Compute Scaling | [`reports/part2/dist/index.html`](./reports/part2/dist/index.html) |

直接下载并用浏览器打开 `dist/index.html`。报告不依赖服务器或外部 JavaScript。

## Codebase profile

代码库报告用于回答：

- 项目解决什么问题，从哪里启动。
- 每个模块负责什么，不负责什么。
- 模块接收哪些输入，产生哪些输出。
- 核心功能按什么步骤实现。
- 谁调用它，它又依赖谁。
- 数据怎样变化，副作用发生在哪里。
- 错误怎样传播，哪些路径有测试。

先生成不包含源码正文和敏感值的静态清单：

```bash
npm run scan:codebase -- ../your-project artifacts/codebase-manifest.json
```

`artifacts/` 默认被 Git 忽略，避免把尚未审阅的私有项目结构提交到当前仓库。

扫描器输出：

- 语言和代码规模
- 包管理与构建清单
- 入口候选
- 顶层模块
- 文件、函数和类的位置
- 内部与外部依赖边
- 被跳过的敏感文件数量

随后按照 [`profiles/CODEBASE_PROFILE.md`](./profiles/CODEBASE_PROFILE.md) 和 [`standards/CODEBASE_CONTENT_TEMPLATE.md`](./standards/CODEBASE_CONTENT_TEMPLATE.md) 生成带文件、行号和调用链证据的 HTML 报告。

## Build

只需要 Node.js 20 或更高版本，无第三方依赖。

```bash
npm run build:part2
npm run lint:part2
npm run test:scanner
npm run privacy
```

完整检查：

```bash
npm test
```

## Repository structure

```text
.
├── docs/                       # README 架构图
├── profiles/                   # 不同材料类型的处理流程
├── reports/
│   └── part2/
│       ├── assets/slides/      # 报告使用的投影片截图
│       ├── data/               # 清洗后的逐字稿
│       ├── scripts/            # 单文件 HTML 构建脚本
│       ├── src/                # HTML、CSS 和交互源码
│       └── dist/index.html     # 可直接打开的最终报告
├── schemas/                    # 中间产物的数据结构
├── standards/                  # 课程与代码库报告规范
└── tools/                      # 报告检查与隐私扫描
```

## Writing standard

- 先讲具体动作和例子，再给术语。
- 每个公式解释用途、符号、数字例子、前提和失效条件。
- 每个知识块给出页码、视频时间、前后关系和边界条件。
- 实验结果必须说明模型、任务、版本和比较范围。
- 测试题不在 HTML 或 JavaScript 中保存答案。

课程规则见 [`standards/STYLE_GUIDE.md`](./standards/STYLE_GUIDE.md) 和 [`standards/CONTENT_TEMPLATE.md`](./standards/CONTENT_TEMPLATE.md)。代码库规则见 [`standards/CODEBASE_STYLE_GUIDE.md`](./standards/CODEBASE_STYLE_GUIDE.md)。

## Included and excluded data

仓库只保留重建报告所需的清洗后逐字稿、投影片截图和源码。以下内容明确排除：

- 原始课程视频
- 下载的论文 PDF
- YouTube 元数据和原始字幕文件
- 浏览器缓存、Cookie 和认证信息
- 本机绝对路径、用户名和个人邮箱
- `.env`、API Key、访问令牌和私钥

`npm run privacy` 会扫描常见个人路径、邮箱和密钥模式。

## License

项目代码和原创文档采用 [MIT License](./LICENSE)。第三方课程、视频、投影片、论文和商标不包含在该授权中。
