(function () {
  'use strict';

  const STORAGE_KEY = 'wechat-md-draft';
  const STATE_KEY = 'wechat-md-state';

  const editor = document.getElementById('editor');
  const preview = document.getElementById('preview');
  const themeSel = document.getElementById('theme');
  const codeStyleSel = document.getElementById('codeStyle');
  const primaryInput = document.getElementById('primary');
  const fontSizeSel = document.getElementById('fontSize');
  const copyBtn = document.getElementById('copy');
  const sampleBtn = document.getElementById('sample');
  const clearBtn = document.getElementById('clear');
  const toast = document.getElementById('toast');
  const codeThemeLink = document.getElementById('code-theme');

  const md = window.markdownit({
    html: false,
    linkify: true,
    breaks: false,
    typographer: false,
    highlight: function (str, lang) {
      if (lang && window.hljs && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
        } catch (_) {}
      }
      if (window.hljs) {
        try { return hljs.highlightAuto(str).value; } catch (_) {}
      }
      return '';
    }
  });

  const MATH_PLACEHOLDER_PREFIX = 'MJXPH';
  const MATH_PLACEHOLDER_SUFFIX = 'PHEND';
  const MATH_PLACEHOLDER_RE = new RegExp(MATH_PLACEHOLDER_PREFIX + '(\\d+)' + MATH_PLACEHOLDER_SUFFIX, 'g');

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function stashMath(text) {
    const blocks = [];
    text = text.replace(/\$\$([\s\S]+?)\$\$/g, (m) => {
      const i = blocks.push(m) - 1;
      return MATH_PLACEHOLDER_PREFIX + i + MATH_PLACEHOLDER_SUFFIX;
    });
    text = text.replace(/(?<![\\$])\$(?![\s\d$])((?:[^$\n\\]|\\.)+?)(?<![\s$])\$(?!\d)/g, (m) => {
      const i = blocks.push(m) - 1;
      return MATH_PLACEHOLDER_PREFIX + i + MATH_PLACEHOLDER_SUFFIX;
    });
    text = text.replace(/\\\[([\s\S]+?)\\\]/g, (m) => {
      const i = blocks.push(m) - 1;
      return MATH_PLACEHOLDER_PREFIX + i + MATH_PLACEHOLDER_SUFFIX;
    });
    text = text.replace(/\\\(([\s\S]+?)\\\)/g, (m) => {
      const i = blocks.push(m) - 1;
      return MATH_PLACEHOLDER_PREFIX + i + MATH_PLACEHOLDER_SUFFIX;
    });
    return { text, blocks };
  }

  function restoreMath(html, blocks) {
    return html.replace(MATH_PLACEHOLDER_RE, (_, i) => escapeHtml(blocks[+i]));
  }

  let themeLinkEl = null;
  function loadTheme(name) {
    if (themeLinkEl) themeLinkEl.remove();
    themeLinkEl = document.createElement('link');
    themeLinkEl.rel = 'stylesheet';
    themeLinkEl.href = `themes/${name}.css`;
    document.head.appendChild(themeLinkEl);
  }

  function loadCodeStyle(name) {
    codeThemeLink.href = `https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/${name}.min.css`;
  }

  function applyPrimary(color) {
    preview.style.setProperty('--primary', color);
  }
  function applyFontSize(size) {
    preview.style.setProperty('font-size', size);
  }

  let mathQueue = Promise.resolve();
  function typesetMath() {
    if (!window.MathJax || !MathJax.typesetPromise) return Promise.resolve();
    mathQueue = mathQueue
      .then(() => MathJax.typesetClear && MathJax.typesetClear([preview]))
      .then(() => MathJax.typesetPromise([preview]))
      .catch(err => console.error('MathJax typeset error:', err));
    return mathQueue;
  }

  function render() {
    const text = editor.value;
    const { text: stashed, blocks } = stashMath(text);
    let html = md.render(stashed);
    html = restoreMath(html, blocks);
    preview.innerHTML = html;
    if (window.hljs) {
      preview.querySelectorAll('pre code').forEach(block => {
        if (!block.dataset.highlighted) {
          block.classList.add('hljs');
          block.dataset.highlighted = '1';
        }
      });
    }
    typesetMath();
    localStorage.setItem(STORAGE_KEY, text);
  }

  const COPY_PROPS = [
    'color', 'background-color', 'background-image',
    'font-family', 'font-size', 'font-weight', 'font-style',
    'line-height', 'letter-spacing', 'text-align', 'text-indent',
    'text-decoration-line', 'text-decoration-color', 'text-decoration-style',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
    'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
    'border-top-left-radius', 'border-top-right-radius',
    'border-bottom-left-radius', 'border-bottom-right-radius',
    'display', 'width', 'max-width', 'height',
    'white-space', 'word-break', 'overflow-x', 'position'
  ];

  function styleObjectToString(obj) {
    return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join('; ');
  }

  const ROOT_DROP_PROPS = new Set([
    'width', 'max-width', 'height',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
    'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
    'border-top-left-radius', 'border-top-right-radius',
    'border-bottom-left-radius', 'border-bottom-right-radius',
    'background-color', 'background-image',
    'display', 'position', 'overflow-x'
  ]);

  function collectStyle(cs) {
    const out = {};
    for (const prop of COPY_PROPS) {
      const v = cs.getPropertyValue(prop);
      if (v && v !== 'normal' && v !== 'none' && v !== 'auto' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)') {
        out[prop] = v;
      }
    }
    return out;
  }

  function inlineTree(sourceRoot, targetRoot) {
    const srcList = [sourceRoot, ...sourceRoot.querySelectorAll('*')];
    const tgtList = [targetRoot, ...targetRoot.querySelectorAll('*')];
    for (let i = 0; i < srcList.length; i++) {
      const src = srcList[i];
      const tgt = tgtList[i];
      if (!tgt) continue;
      const cs = window.getComputedStyle(src);
      const styleMap = collectStyle(cs);
      if (i === 0) {
        for (const k of ROOT_DROP_PROPS) delete styleMap[k];
      }
      tgt.setAttribute('style', styleObjectToString(styleMap));

      ['::before', '::after'].forEach(pseudo => {
        const pcs = window.getComputedStyle(src, pseudo);
        const content = pcs.getPropertyValue('content');
        if (content && content !== 'none' && content !== 'normal' && content !== '""') {
          const text = content.replace(/^["']|["']$/g, '').replace(/\\([0-9a-fA-F]+)\s?/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
          if (!text) return;
          const span = document.createElement('span');
          span.textContent = text;
          span.setAttribute('style', styleObjectToString(collectStyle(pcs)));
          if (pseudo === '::before') tgt.insertBefore(span, tgt.firstChild);
          else tgt.appendChild(span);
        }
      });
    }
    targetRoot.removeAttribute('class');
    targetRoot.querySelectorAll('[class]').forEach(el => el.removeAttribute('class'));
  }

  function svgToPngDataUrl(svgEl, scale) {
    return new Promise((resolve, reject) => {
      const cloned = svgEl.cloneNode(true);
      if (!cloned.getAttribute('xmlns')) {
        cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }
      const rect = svgEl.getBoundingClientRect();
      const cssW = rect.width || parseFloat(svgEl.getAttribute('width')) || 0;
      const cssH = rect.height || parseFloat(svgEl.getAttribute('height')) || 0;
      if (!cssW || !cssH) { reject(new Error('zero-size svg')); return; }
      cloned.setAttribute('width', cssW);
      cloned.setAttribute('height', cssH);
      const xml = new XMLSerializer().serializeToString(cloned);
      const b64 = btoa(unescape(encodeURIComponent(xml)));
      const dataUri = 'data:image/svg+xml;base64,' + b64;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(cssW * scale);
        canvas.height = Math.ceil(cssH * scale);
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, cssW, cssH);
        try {
          resolve({ dataUrl: canvas.toDataURL('image/png'), width: cssW, height: cssH });
        } catch (e) { reject(e); }
      };
      img.onerror = (e) => reject(e);
      img.src = dataUri;
    });
  }

  async function convertMathToImages(root, sourceRoot) {
    const cloneContainers = root.querySelectorAll('mjx-container');
    const sourceContainers = sourceRoot.querySelectorAll('mjx-container');
    for (let i = 0; i < cloneContainers.length; i++) {
      const cloneEl = cloneContainers[i];
      const srcEl = sourceContainers[i];
      if (!srcEl) continue;
      const svg = srcEl.querySelector('svg');
      if (!svg) continue;
      const isDisplay = srcEl.getAttribute('display') === 'true' || cloneEl.getAttribute('display') === 'true';
      const svgInlineStyle = svg.getAttribute('style') || '';
      const vaMatch = svgInlineStyle.match(/vertical-align\s*:\s*(-?[\d.]+(?:ex|em|px|%))/i);
      const verticalAlign = vaMatch ? vaMatch[1] : null;
      try {
        const { dataUrl, width, height } = await svgToPngDataUrl(svg, 2);
        const img = document.createElement('img');
        img.src = dataUrl;
        img.alt = srcEl.getAttribute('aria-label') || 'formula';
        let style = '';
        if (isDisplay) {
          style = `display:block;margin:1em auto;max-width:100%;width:${width}px;height:auto;`;
        } else {
          style = `display:inline-block;width:${width}px;height:${height}px;`;
          if (verticalAlign) {
            style += `vertical-align:${verticalAlign};`;
          }
        }
        img.setAttribute('style', style);
        cloneEl.parentNode.replaceChild(img, cloneEl);
      } catch (e) {
        console.error('formula image conversion failed:', e);
        const fallback = document.createElement('span');
        fallback.textContent = srcEl.getAttribute('aria-label') || '[公式]';
        fallback.setAttribute('style', 'color:#c00;font-family:monospace;');
        cloneEl.parentNode.replaceChild(fallback, cloneEl);
      }
    }
  }

  async function buildInlinedHTML() {
    const clone = preview.cloneNode(true);
    inlineTree(preview, clone);
    await convertMathToImages(clone, preview);
    return clone.outerHTML;
  }

  async function copyToWechat() {
    if (!editor.value.trim()) {
      showToast('内容为空');
      return;
    }
    await mathQueue;
    const html = await buildInlinedHTML();
    try {
      if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        const plain = preview.innerText;
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([plain], { type: 'text/plain' })
          })
        ]);
      } else {
        fallbackCopyHTML(html);
      }
      showToast('已复制，去公众号编辑器粘贴即可 ✓');
    } catch (e) {
      console.error(e);
      fallbackCopyHTML(html);
      showToast('已复制（兼容模式）');
    }
  }

  function fallbackCopyHTML(html) {
    const box = document.createElement('div');
    box.contentEditable = 'true';
    box.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    box.innerHTML = html;
    document.body.appendChild(box);
    const range = document.createRange();
    range.selectNodeContents(box);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    try { document.execCommand('copy'); } catch (_) {}
    sel.removeAllRanges();
    document.body.removeChild(box);
  }

  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  const SAMPLE = `# 示例：一篇公众号文章

> 这是一个 Markdown 转公众号排版工具。左侧写作，右侧实时预览，一键复制到公众号编辑器。

## 二级标题

支持常见的 **加粗**、*斜体*、~~删除线~~、\`行内代码\` 和 [超链接](https://github.com)。

### 三级标题

无序列表：

- 列表项一
- 列表项二
  - 嵌套列表项
- 列表项三

有序列表：

1. 第一步
2. 第二步
3. 第三步

### 代码块

\`\`\`javascript
function greet(name) {
  const msg = \`Hello, \${name}!\`;
  console.log(msg);
  return msg;
}

greet('公众号');
\`\`\`

### 引用

> 引用一段话，表达克制而优雅。
> —— 某位作者

### 表格

| 框架 | 类型 | 特点 |
| --- | --- | --- |
| Hexo | 静态 | 插件丰富 |
| Hugo | 静态 | 构建最快 |
| Astro | 静态 | 组件化 |

### 数学公式

行内公式：质能方程 $E = mc^2$，欧拉恒等式 $e^{i\\pi} + 1 = 0$。

块级公式：

$$
\\int_{-\\infty}^{+\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
$$

$$
\\frac{\\partial}{\\partial t}\\Psi = -\\frac{\\hbar^2}{2m}\\nabla^2\\Psi + V\\Psi
$$

### 化学方程式

行内：水的分子式 $\\ce{H2O}$，硫酸 $\\ce{H2SO4}$。

块级反应方程：

$$
\\ce{2H2 + O2 -> 2H2O}
$$

$$
\\ce{CO2 + H2O <=> H2CO3 <=> H+ + HCO3^-}
$$

### 分隔线

---

### 图片

公众号正文图片需要在公众号编辑器里点击「图片」按钮上传，本工具复制内容里如有 \`http(s)://\` 外链图片，公众号会拒绝插入（防盗链）。

公式之所以能正常显示，是因为它们在复制时已被栅格化为 dataURL，公众号会自动转存到自己的 CDN。

排版完成后，点击右上角 **「复制到公众号」**，然后在公众号编辑器里直接粘贴即可。
`;

  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
      if (s.theme) { themeSel.value = s.theme; }
      if (s.codeStyle) { codeStyleSel.value = s.codeStyle; }
      if (s.primary) { primaryInput.value = s.primary; }
      if (s.fontSize) { fontSizeSel.value = s.fontSize; }
    } catch (_) {}
  }
  function saveState() {
    localStorage.setItem(STATE_KEY, JSON.stringify({
      theme: themeSel.value,
      codeStyle: codeStyleSel.value,
      primary: primaryInput.value,
      fontSize: fontSizeSel.value
    }));
  }

  function init() {
    loadState();
    loadTheme(themeSel.value);
    loadCodeStyle(codeStyleSel.value);
    applyPrimary(primaryInput.value);
    applyFontSize(fontSizeSel.value);

    const saved = localStorage.getItem(STORAGE_KEY);
    editor.value = saved && saved.length ? saved : SAMPLE;
    render();

    editor.addEventListener('input', render);

    themeSel.addEventListener('change', () => {
      loadTheme(themeSel.value);
      saveState();
    });
    codeStyleSel.addEventListener('change', () => {
      loadCodeStyle(codeStyleSel.value);
      saveState();
    });
    primaryInput.addEventListener('input', () => {
      applyPrimary(primaryInput.value);
      saveState();
    });
    fontSizeSel.addEventListener('change', () => {
      applyFontSize(fontSizeSel.value);
      saveState();
    });

    copyBtn.addEventListener('click', copyToWechat);
    sampleBtn.addEventListener('click', () => {
      editor.value = SAMPLE;
      render();
    });
    clearBtn.addEventListener('click', () => {
      if (editor.value && !confirm('确定清空当前内容？')) return;
      editor.value = '';
      render();
    });

    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart, end = editor.selectionEnd;
        editor.setRangeText('  ', start, end, 'end');
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        copyToWechat();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
