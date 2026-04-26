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

  function render() {
    const text = editor.value;
    preview.innerHTML = md.render(text);
    if (window.hljs) {
      preview.querySelectorAll('pre code').forEach(block => {
        if (!block.dataset.highlighted) {
          block.classList.add('hljs');
          block.dataset.highlighted = '1';
        }
      });
    }
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

  function buildInlinedHTML() {
    const clone = preview.cloneNode(true);
    inlineTree(preview, clone);
    return clone.outerHTML;
  }

  async function copyToWechat() {
    if (!editor.value.trim()) {
      showToast('内容为空');
      return;
    }
    const html = buildInlinedHTML();
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

### 分隔线

---

### 图片

![示例图片](https://via.placeholder.com/600x200/1aad19/ffffff?text=Sample+Image)

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
