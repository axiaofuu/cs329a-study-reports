# 内容模板

## 首页

- 英文课程标题
- 一句话中文问题：这节课究竟研究什么
- 视频发布日期、授课日期、讲者、时长、逐字稿字数

## 版本与材料

- 这份报告对应哪一版课程
- 是否存在官方 PPT；如果没有，说明录像截图和论文如何互相校正
- 官方视频、官网和指定阅读

## 学习路线

每张知识块卡片填写：

- 一个学生会自然提出的问题
- 投影片页码范围
- 视频时间范围
- 两句以内的白话说明

推进链使用具体动作，例如：

`先让正确答案出现 → 把它挑出来 → 把计算量花对 → 组合完整系统`

## 知识块

```html
<section class="section" id="block-N" data-section data-knowledge-block>
  <div class="block-head">
    <div><p class="section-kicker">知识块 N</p><h2>问句式标题</h2></div>
    <div class="block-meta"><strong>投影片 pX–Y</strong>00:00–00:00</div>
  </div>
  <p class="lead" data-prose>不用术语也能读懂的问题背景。</p>

  <article class="page-step" data-slide>
    <h3>pX–Y｜这一页回答的具体问题</h3>
    <p data-role="what" data-prose>老师在讲什么。</p>
    <p data-role="why" data-prose>为什么现在讲。</p>
    <p data-role="relation" data-prose>它与前后内容的关系。</p>
  </article>

  <div class="formula" data-formula>
    公式
    <small data-role="plain">用途和符号。数字例子。成立前提。失效条件。</small>
  </div>

  <figure class="figure">
    <img src="..." alt="具体图意">
    <figcaption><strong>投影片 pX · 00:00</strong> 图证明什么；不能外推到哪里。</figcaption>
  </figure>

  <div class="callout gold"><strong>边界条件</strong>何时无效，或遗漏了什么成本。</div>
</section>
```

## 末尾固定区

1. 字幕纠错：错误原文、正确表述、必要解释。
2. 6–10 道测试题，不给答案。
3. 带时间戳、可搜索的完整逐字稿。
4. 官网、视频、论文版本和本地材料。

视觉样式和交互直接复用 `reports/part2/src/style.css` 与 `reports/part2/src/app.js`。
