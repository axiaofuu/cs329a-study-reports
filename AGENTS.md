# Study Report Engine 约束

先判断任务使用哪个 profile。

课程报告必须阅读：

- `standards/STYLE_GUIDE.md`
- `standards/CONTENT_TEMPLATE.md`

代码库报告必须阅读：

- `profiles/CODEBASE_PROFILE.md`
- `standards/CODEBASE_STYLE_GUIDE.md`
- `standards/CODEBASE_CONTENT_TEMPLATE.md`

代码库报告必须先生成 `codebase-manifest.json`，再根据代码位置建立证据图。每个核心模块都要说明作用、入口、输入、输出、实现步骤、依赖、副作用、错误处理和测试证据。无法确认的内容明确标记为未确认。

每次交付前必须执行：

```bash
npm test
```

必须修复全部错误并审阅全部警告。不得提交原始视频、下载的论文、认证信息、本机绝对路径、个人邮箱、用户数据或测试题答案。

Part 2 是内容密度、语言难度和视觉结构的基准实现。
