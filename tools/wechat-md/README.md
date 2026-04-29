# 公众号 Markdown 排版工具

一个纯静态的 Markdown → 微信公众号编辑器排版工具，参考 mdnice / doocs-md 的思路。

**在线使用**：部署到 GitHub Pages 后访问 `/tools/wechat-md/`。

## 功能

- 实时预览 Markdown 渲染效果
- 三套内置主题（默认绿 / 优雅黑 / 暖橙）
- 代码高亮（atom-one-light / github / vs2015 / monokai）
- 自定义主色、字号
- 一键复制带**内联样式**的 HTML，直接粘贴到公众号编辑器
- 自动保存草稿到 localStorage
- `Ctrl/Cmd + Enter` 快捷复制
- 支持 GFM：表格、代码块、任务列表、删除线、链接识别
- **数学公式**：`$...$` 行内 / `$$...$$` 块级，LaTeX 语法
- **化学方程式**：通过 mhchem 扩展支持 `\ce{...}`、`\bond{...}`

## 实现要点

| 部分 | 说明 |
| --- | --- |
| Markdown 解析 | `markdown-it` (CDN) |
| 代码高亮 | `highlight.js` (CDN) |
| 公式渲染 | `MathJax 3` (SVG 输出，加载 `mhchem` 扩展支持化学式) |
| 内联样式 | `getComputedStyle` 遍历预览 DOM，把主题 CSS 折叠成 `style` 属性 |
| 伪元素 | `::before/::after` 的 `content` 展开为真实 `<span>` 节点 |
| 公式图片化 | 复制时把每个 `<mjx-container>` 的 SVG 用 Canvas 栅格化为 2× DPR 的 PNG dataURL，替换为 `<img>`，并保留 `vertical-align` 行内基线偏移 |
| 剪贴板 | `ClipboardItem` + `text/html`，降级到 `execCommand('copy')` |

公众号编辑器会剥掉 `class` 和外部样式表，只保留 `style` 属性，所以复制前必须把所有视觉效果"烧进" inline style，这是核心思路。

公式之所以走"图片化"而不是 SVG 内联，是因为公众号编辑器在不同客户端版本下对 `<svg>`、MathML、KaTeX HTML 的兼容性都不稳定。**PNG `<img>` 是唯一在所有微信客户端都稳定显示的方式**——粘贴到公众号编辑器后，编辑器会自动把 dataURL 转存到 `mmbiz.qpic.cn`。

### 公式语法示例

| 类型 | 写法 |
| --- | --- |
| 行内数学 | `$E = mc^2$` |
| 块级数学 | `$$\int_0^1 x\,dx$$` |
| 行内化学 | `$\ce{H2O}$` |
| 化学反应 | `$$\ce{2H2 + O2 -> 2H2O}$$` |
| 可逆反应 | `$$\ce{CO2 + H2O <=> H2CO3}$$` |

## 目录

```
tools/wechat-md/
├── index.html      页面骨架
├── ui.css          工具链界面样式（不进入复制内容）
├── app.js          渲染 + 主题切换 + 内联复制
├── themes/
│   ├── default.css 默认绿主题
│   ├── elegant.css 优雅黑主题
│   └── orange.css  暖橙主题
└── README.md
```

## 新增主题

复制任一 `themes/*.css`，所有选择器限定在 `.wechat-body` 内；然后在 `index.html` 的 `<select id="theme">` 添加一项即可。
