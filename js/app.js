/* ============================================
   MD Hub — 主应用逻辑
   ============================================ */

// ========== 状态管理 ==========
const STATE = {
  currentFile: null,
  isEditing: false,
  isLoggedIn: false,
  isSidebarOpen: true,
  isTocOpen: true,
  currentTheme: localStorage.getItem('mdhub-theme') || 'dark-plus',
  structure: [],
  tocItems: [],
};

// ========== DOM 引用 ==========
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ========== 初始化 ==========
async function init() {
  // 立即隐藏 FOUC 遮罩（使用 CSS 动画安全阀已做兜底）
  const fouc = document.getElementById('fouc-overlay');
  if (fouc) {
    fouc.classList.add('fade-out');
    setTimeout(() => { if (fouc.parentNode) fouc.parentNode.removeChild(fouc); }, 300);
  }

  // 确保 CDN 库已加载（defer 失败时兜底加载）
  await ensureCdnLibs();

  // 设置主题
  document.documentElement.setAttribute('data-theme', STATE.currentTheme);
  document.getElementById('current-theme-label').textContent = getThemeLabel(STATE.currentTheme);
  // 高亮当前主题
  document.querySelectorAll('.theme-picker-item').forEach(el => {
    el.classList.toggle('active', el.dataset.themeId === STATE.currentTheme);
  });

  // 检查弹窗状态
  if (!localStorage.getItem('mdhub-risk-accepted')) {
    document.getElementById('risk-modal').classList.add('active');
  }

  // 检查移动端
  if (/Mobi|Android|iPhone/i.test(navigator.userAgent)) {
    setTimeout(() => {
      document.getElementById('mobile-modal').classList.add('active');
    }, 500);
  }

  // 加载目录结构和内容
  await loadStructure();
  await loadContent('index.md');
  
  // 还原侧边栏状态
  if (localStorage.getItem('mdhub-sidebar') === 'closed') {
    toggleSidebar();
  }
  if (localStorage.getItem('mdhub-toc') === 'closed') {
    toggleToc();
  }

  // 事件绑定
  bindEvents();
}

// ========== 主题管理 ==========
const THEMES = [
  { id: 'dark-plus', label: '🌙 Dark+', group: 'dark' },
  { id: 'github-dark', label: '🐙 GitHub Dark', group: 'dark' },
  { id: 'monokai', label: '🎨 Monokai', group: 'dark' },
  { id: 'solarized-dark', label: '☀️ Solarized Dark', group: 'dark' },
  { id: 'one-dark-pro', label: '🔵 One Dark Pro', group: 'dark' },
  { id: 'dracula', label: '🧛 Dracula', group: 'dark' },
  { id: 'nord', label: '❄️ Nord', group: 'dark' },
  { id: 'catppuccin-mocha', label: '🐱 Catppuccin Mocha', group: 'dark' },
  { id: 'tokyo-night', label: '🌃 Tokyo Night', group: 'dark' },
  { id: 'gruvbox-dark', label: '🟠 Gruvbox Dark', group: 'dark' },
  { id: 'ayu-mirage', label: '🌅 Ayu Mirage', group: 'dark' },
  { id: 'rose-pine', label: '🌹 Rosé Pine', group: 'dark' },
  { id: 'light-plus', label: '☁️ Light+', group: 'light' },
  { id: 'github-light', label: '🐙 GitHub Light', group: 'light' },
  { id: 'solarized-light', label: '🌤️ Solarized Light', group: 'light' },
  { id: 'catppuccin-latte', label: '🐱 Catppuccin Latte', group: 'light' },
];

function getThemeLabel(themeId) {
  const t = THEMES.find(t => t.id === themeId);
  return t ? t.label : themeId;
}

function setTheme(themeId) {
  STATE.currentTheme = themeId;
  document.documentElement.setAttribute('data-theme', themeId);
  document.getElementById('current-theme-label').textContent = getThemeLabel(themeId);
  localStorage.setItem('mdhub-theme', themeId);
  // 高亮当前主题
  document.querySelectorAll('.theme-picker-item').forEach(el => {
    el.classList.toggle('active', el.dataset.themeId === themeId);
  });
  closeThemePicker();
}

function toggleThemePicker() {
  document.getElementById('theme-picker').classList.toggle('active');
}

function closeThemePicker() {
  document.getElementById('theme-picker').classList.remove('active');
}

// ========== 侧边栏 ==========
function toggleSidebar() {
  STATE.isSidebarOpen = !STATE.isSidebarOpen;
  document.getElementById('sidebar').classList.toggle('closed', !STATE.isSidebarOpen);
  document.getElementById('content-area').classList.toggle('sidebar-closed', !STATE.isSidebarOpen);
  localStorage.setItem('mdhub-sidebar', STATE.isSidebarOpen ? 'open' : 'closed');
}

function toggleToc() {
  STATE.isTocOpen = !STATE.isTocOpen;
  document.getElementById('toc-panel').classList.toggle('closed', !STATE.isTocOpen);
  document.getElementById('content-area').classList.toggle('toc-closed', !STATE.isTocOpen);
  localStorage.setItem('mdhub-toc', STATE.isTocOpen ? 'open' : 'closed');
}

// ========== 目录结构加载 ==========
async function loadStructure() {
  try {
    const res = await fetch('config/structure.json');
    STATE.structure = await res.json();
    renderSidebar(STATE.structure);
    renderTocConfig(STATE.structure);
  } catch (e) {
    console.error('加载目录结构失败:', e);
    document.getElementById('sidebar-tree').innerHTML = '<div class="tree-error">加载失败</div>';
  }
}

function renderSidebar(items, container, basePath = '') {
  container = container || document.getElementById('sidebar-tree');
  container.innerHTML = '';
  
  items.forEach(item => {
    if (item.type === 'file') {
      const fullPath = basePath + item.name;
      const el = document.createElement('div');
      el.className = 'tree-item file-item';
      el.dataset.path = fullPath;
      el.innerHTML = `<span class="tree-icon">📄</span><span class="tree-label">${item.label || item.name}</span>`;
      el.addEventListener('click', () => loadContent(fullPath));
      if (STATE.currentFile === fullPath) el.classList.add('active');
      container.appendChild(el);
    } else if (item.type === 'directory') {
      const group = document.createElement('div');
      group.className = 'tree-group';
      
      const header = document.createElement('div');
      header.className = 'tree-item dir-item';
      header.innerHTML = `<span class="tree-arrow">▶</span><span class="tree-icon">📁</span><span class="tree-label">${item.label || item.name}</span>`;
      
      const children = document.createElement('div');
      children.className = 'tree-children';
      
      header.addEventListener('click', () => {
        header.classList.toggle('collapsed');
        children.classList.toggle('hidden');
        header.querySelector('.tree-arrow').textContent = 
          children.classList.contains('hidden') ? '▶' : '▼';
      });
      
      // 默认展开
      renderSidebar(item.children || [], children, basePath + item.name + '/');
      
      group.appendChild(header);
      group.appendChild(children);
      container.appendChild(group);
    }
  });
}

// ========== 内容加载 ==========
async function loadContent(filePath) {
  if (!filePath) return;
  
  STATE.currentFile = filePath;
  document.getElementById('content-loading').style.display = 'block';
  document.getElementById('content-render').style.display = 'none';
  
  // 高亮侧边栏
  $$('.tree-item.active').forEach(el => el.classList.remove('active'));
  $$(`.tree-item[data-path="${filePath}"]`).forEach(el => el.classList.add('active'));
  
  try {
    const res = await fetch(`content/${filePath}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const md = await res.text();
    
    // 检查本地编辑
    const saved = localStorage.getItem(`mdhub-edit-${filePath}`);
    const content = saved || md;
    
    renderContent(content, filePath);
    
    // 存储原始内容用于取消编辑
    document.getElementById('content-editor').dataset.original = md;
  } catch (e) {
    console.error('加载内容失败:', e);
    document.getElementById('content-render').innerHTML = `<div class="content-error">❌ 加载失败: ${filePath}</div>`;
    document.getElementById('content-loading').style.display = 'none';
    document.getElementById('content-render').style.display = 'block';
  }
}

function renderContent(md, filePath) {
  const renderEl = document.getElementById('content-render');
  const editor = document.getElementById('content-editor');
  
  // 使用 marked 渲染
  if (typeof marked !== 'undefined') {
    marked.setOptions({
      breaks: true,
      gfm: true,
      highlight: function(code, lang) {
        if (lang && typeof hljs !== 'undefined' && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch(e) {}
        }
        return code;
      }
    });
    
    const html = marked.parse(md);
    renderEl.innerHTML = html;
    
    // 代码高亮
    if (typeof hljs !== 'undefined') {
      renderEl.querySelectorAll('pre code').forEach(block => {
        try { hljs.highlightElement(block); } catch(e) {}
      });
    } else {
      // hljs 不可用时的备用样式
      renderEl.querySelectorAll('pre').forEach(pre => {
        pre.style.background = 'var(--code-bg)';
        pre.style.padding = '16px';
        pre.style.borderRadius = 'var(--radius-md)';
        pre.style.overflowX = 'auto';
      });
    }
    
    // 渲染数学公式（使用 KaTeX auto-render）
    if (typeof renderMathInElement !== 'undefined') {
      try {
        renderMathInElement(renderEl, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\(', right: '\\)', display: false},
            {left: '\\[', right: '\\]', display: true}
          ],
          throwOnError: false
        });
      } catch(e) {
        console.warn('KaTeX render error:', e);
      }
    }
  } else {
    renderEl.textContent = md;
  }
  
  // 处理表格
  renderEl.querySelectorAll('table').forEach(t => {
    t.classList.add('md-table');
    if (!t.parentElement.classList.contains('table-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'table-wrapper';
      t.parentNode.insertBefore(wrapper, t);
      wrapper.appendChild(t);
    }
  });
  
  // 为标题添加锚点
  renderEl.querySelectorAll('h1, h2, h3, h4').forEach(h => {
    if (!h.id) {
      h.id = h.textContent
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
  });
  
  // 生成 TOC
  generateToc(renderEl);
  
  // 更新当前文件标签
  const fileLabel = getFileLabel(filePath);
  document.getElementById('current-file-label').textContent = fileLabel || filePath;
  // 更新页面标题
  document.title = fileLabel ? `${fileLabel} · MD Hub` : 'MD Hub · 个人知识库';

  // 存储内容到编辑器
  editor.value = md;
  
  document.getElementById('content-loading').style.display = 'none';
  renderEl.style.display = 'block';
  
  // 更新 URL hash
  history.replaceState(null, '', '#' + filePath);
}

// ========== TOC 生成 ==========
function generateToc(container) {
  const tocEl = document.getElementById('toc-list');
  tocEl.innerHTML = '';
  STATE.tocItems = [];
  
  const headings = container.querySelectorAll('h1, h2, h3, h4');
  
  headings.forEach(h => {
    const level = parseInt(h.tagName.charAt(1));
    const text = h.textContent;
    const id = h.id;
    
    STATE.tocItems.push({ level, text, id });
    
    const li = document.createElement('li');
    li.className = `toc-item toc-h${level}`;
    li.innerHTML = `<a href="#${id}">${text}</a>`;
    li.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    tocEl.appendChild(li);
  });
}

// ========== 编辑模式 ==========
function toggleEdit() {
  STATE.isEditing = !STATE.isEditing;
  const renderEl = document.getElementById('content-render');
  const editor = document.getElementById('content-editor');
  const editBtn = document.getElementById('btn-edit');
  const saveBtn = document.getElementById('btn-save');
  const cancelBtn = document.getElementById('btn-cancel');
  
  if (STATE.isEditing) {
    renderEl.style.display = 'none';
    editor.style.display = 'block';
    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline-flex';
    cancelBtn.style.display = 'inline-flex';
  } else {
    renderEl.style.display = 'block';
    editor.style.display = 'none';
    editBtn.style.display = 'inline-flex';
    saveBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
  }
}

function saveContent() {
  const editor = document.getElementById('content-editor');
  const md = editor.value;
  const filePath = STATE.currentFile;
  
  if (!filePath) return;
  
  localStorage.setItem(`mdhub-edit-${filePath}`, md);
  renderContent(md, filePath);
  toggleEdit();
  showToast('💾 已保存到本地');
}

function cancelEdit() {
  const editor = document.getElementById('content-editor');
  const original = editor.dataset.original || '';
  
  if (localStorage.getItem(`mdhub-edit-${STATE.currentFile}`)) {
    localStorage.removeItem(`mdhub-edit-${STATE.currentFile}`);
  }
  
  renderContent(original, STATE.currentFile);
  toggleEdit();
}

// ========== 搜索 ==========
let searchResults = [];
let isSearching = false;

async function toggleSearch() {
  const overlay = document.getElementById('search-overlay');
  overlay.classList.toggle('active');
  if (overlay.classList.contains('active')) {
    document.getElementById('search-input').focus();
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').innerHTML = '';
  }
}

async function doSearch(query) {
  if (!query.trim() || isSearching) return;
  isSearching = true;
  
  const resultsEl = document.getElementById('search-results');
  resultsEl.innerHTML = '<div class="search-status">🔍 搜索中...</div>';
  
  try {
    const allFiles = getAllMdFiles(STATE.structure);
    const results = [];
    
    for (const file of allFiles) {
      try {
        const res = await fetch(`content/${file.path}`);
        if (!res.ok) continue;
        const text = await res.text();
        
        if (text.toLowerCase().includes(query.toLowerCase())) {
          // 找到匹配片段
          const lines = text.split('\n');
          const matchedLines = [];
          lines.forEach((line, i) => {
            if (line.toLowerCase().includes(query.toLowerCase())) {
              const idx = line.toLowerCase().indexOf(query.toLowerCase());
              const start = Math.max(0, idx - 30);
              const end = Math.min(line.length, idx + query.length + 30);
              let snippet = line.substring(start, end);
              if (start > 0) snippet = '...' + snippet;
              if (end < line.length) snippet = snippet + '...';
              matchedLines.push({ line: i + 1, snippet });
            }
          });
          
          results.push({
            path: file.path,
            label: file.label,
            matches: matchedLines
          });
        }
      } catch(e) {}
    }
    
    searchResults = results;
    
    if (results.length === 0) {
      resultsEl.innerHTML = '<div class="search-status">😕 未找到匹配结果</div>';
    } else {
      resultsEl.innerHTML = results.map(r => `
        <div class="search-result-item" onclick="loadContent('${r.path}'); toggleSearch();">
          <div class="search-result-title">📄 ${r.label}</div>
          <div class="search-result-path">${r.path}</div>
          ${r.matches.slice(0, 3).map(m => `
            <div class="search-result-snippet">
              <span class="search-line">行 ${m.line}:</span> 
              ${highlightMatch(m.snippet, query)}
            </div>
          `).join('')}
          ${r.matches.length > 3 ? `<div class="search-result-more">...还有 ${r.matches.length - 3} 处匹配</div>` : ''}
        </div>
      `).join('');
    }
  } catch(e) {
    resultsEl.innerHTML = '<div class="search-status">❌ 搜索出错</div>';
  }
  
  isSearching = false;
}

function highlightMatch(text, query) {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
}

function getAllMdFiles(items, basePath = '') {
  let files = [];
  items.forEach(item => {
    if (item.type === 'file') {
      files.push({ path: basePath + item.name, label: item.label || item.name });
    } else if (item.type === 'directory') {
      files = files.concat(getAllMdFiles(item.children || [], basePath + item.name + '/'));
    }
  });
  return files;
}

function getFileLabel(filePath) {
  const all = getAllMdFiles(STATE.structure);
  const found = all.find(f => f.path === filePath);
  return found ? found.label : filePath;
}

// ========== 截图 ==========
async function captureScreenshot() {
  if (typeof html2canvas === 'undefined') {
    showToast('📸 请稍候，加载截图库...');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  }
  
  const content = document.getElementById('content-render');
  const btn = document.getElementById('btn-screenshot');
  btn.textContent = '⏳';
  btn.disabled = true;
  
  try {
    const canvas = await html2canvas(content, {
      backgroundColor: getComputedStyle(document.body).backgroundColor,
      scale: 2,
      useCORS: true,
      logging: false
    });
    
    const link = document.createElement('a');
    link.download = `screenshot-${STATE.currentFile.replace(/[/.]/g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    showToast('📸 截图已下载');
  } catch(e) {
    console.error('截图失败:', e);
    showToast('❌ 截图失败');
  }
  
  btn.textContent = '📸 截图';
  btn.disabled = false;
}

async function copyScreenshot() {
  if (typeof html2canvas === 'undefined') {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  }
  
  try {
    const canvas = await html2canvas(document.getElementById('content-render'), {
      backgroundColor: getComputedStyle(document.body).backgroundColor,
      scale: 2,
      useCORS: true,
      logging: false
    });
    
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    showToast('📋 已复制到剪贴板');
  } catch(e) {
    showToast('❌ 复制失败');
  }
}

// ========== 管理员登录 ==========
function openLogin() {
  document.getElementById('login-modal').classList.add('active');
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').style.display = 'none';
}

function closeLogin() {
  document.getElementById('login-modal').classList.remove('active');
}

function doLogin() {
  const pwd = document.getElementById('login-password').value;
  const configPwd = localStorage.getItem('mdhub-admin-pwd') || 'admin123';
  
  if (pwd === configPwd) {
    STATE.isLoggedIn = true;
    document.getElementById('btn-login').textContent = '🔓 已登录';
    closeLogin();
    showToast('🔓 登录成功');
    renderTocConfig(STATE.structure);
  } else {
    document.getElementById('login-error').style.display = 'block';
  }
}

function doLogout() {
  STATE.isLoggedIn = false;
  document.getElementById('btn-login').textContent = '🔒 登录';
  showToast('🔒 已退出');
}

// ========== 目录配置 ==========
function renderTocConfig(structure) {
  const configEl = document.getElementById('toc-config-list');
  if (!configEl) return;
  
  configEl.innerHTML = '';
  const isAdmin = STATE.isLoggedIn;
  
  function renderItems(items, depth = 0) {
    items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'config-row';
      row.style.paddingLeft = `${depth * 20 + 8}px`;
      
      row.innerHTML = `
        <span class="config-icon">${item.type === 'directory' ? '📁' : '📄'}</span>
        <span class="config-label">${item.label || item.name}</span>
        <span class="config-type">${item.type === 'directory' ? '目录' : '文件'}</span>
        ${isAdmin ? `
          <button class="config-btn config-btn-sm" onclick="renameItem(${idx})" title="重命名">✏️</button>
          <button class="config-btn config-btn-sm config-btn-del" onclick="deleteItem(${idx})" title="删除">🗑️</button>
        ` : ''}
      `;
      
      configEl.appendChild(row);
      
      if (item.children) {
        renderItems(item.children, depth + 1);
      }
    });
  }
  
  renderItems(structure);
}

function openTocConfig() {
  document.getElementById('toc-config-modal').classList.add('active');
}

function closeTocConfig() {
  document.getElementById('toc-config-modal').classList.remove('active');
}

function addDirectory() {
  const name = prompt('输入目录名称：');
  if (!name) return;
  
  STATE.structure.push({
    type: 'directory',
    name: name,
    label: `📁 ${name}`,
    children: []
  });
  
  renderSidebar(STATE.structure);
  renderTocConfig(STATE.structure);
  showToast(`📁 已添加目录: ${name}`);
}

function renameItem(idx) {
  const newName = prompt('输入新名称：', STATE.structure[idx]?.label || '');
  if (!newName) return;
  STATE.structure[idx].label = newName;
  renderSidebar(STATE.structure);
  renderTocConfig(STATE.structure);
}

function deleteItem(idx) {
  if (!confirm(`确定删除 "${STATE.structure[idx]?.label}"？`)) return;
  STATE.structure.splice(idx, 1);
  renderSidebar(STATE.structure);
  renderTocConfig(STATE.structure);
}

function saveTocConfig() {
  // 保存到 localStorage
  localStorage.setItem('mdhub-structure', JSON.stringify(STATE.structure));
  showToast('✅ 配置已保存（仅本地）');
  closeTocConfig();
}

// ========== 弹窗管理 ==========
function acceptRisk() {
  localStorage.setItem('mdhub-risk-accepted', 'true');
  document.getElementById('risk-modal').classList.remove('active');
}

function dismissMobile() {
  document.getElementById('mobile-modal').classList.remove('active');
}

// ========== Toast 通知 ==========
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('active');
  setTimeout(() => toast.classList.remove('active'), 2500);
}

// ========== 辅助工具 ==========
function loadScript(src) {
  return new Promise((resolve, reject) => {
    // 避免重复加载
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing && existing.dataset.loaded === 'true') return resolve();
    
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
    script.onerror = () => { console.warn(`CDN 加载失败: ${src}`); reject(new Error(src)); };
    document.head.appendChild(script);
  });
}

async function ensureCdnLibs() {
  const libs = [
    { var: 'marked', url: 'https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js' },
    { var: 'hljs', url: 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js' },
    { var: 'katex', url: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js' },
    { var: 'renderMathInElement', url: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js' },
  ];
  
  for (const lib of libs) {
    if (typeof window[lib.var] === 'undefined') {
      try {
        await loadScript(lib.url);
        console.log(`✅ CDN 已加载: ${lib.var}`);
      } catch(e) {
        console.warn(`⚠️ CDN 加载失败，降级运行: ${lib.var}`);
      }
    }
  }
}

// ========== 事件绑定 ==========
function bindEvents() {
  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + S 保存
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      if (STATE.isEditing) {
        e.preventDefault();
        saveContent();
      }
    }
    // Ctrl/Cmd + K 搜索
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      toggleSearch();
    }
    // Ctrl/Cmd + B 切换侧边栏
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      toggleSidebar();
    }
    // Escape 关闭弹窗
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
      document.getElementById('search-overlay').classList.remove('active');
      closeThemePicker();
    }
  });
  
  // 点击外部关闭搜索
  document.getElementById('search-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) toggleSearch();
  });
  
  // 点击外部关闭弹窗
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) m.classList.remove('active');
    });
  });
  
  // 搜索防抖
  let searchTimer;
  document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => doSearch(e.target.value), 300);
  });
  
  // 点击外部关闭主题选择器
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#theme-picker') && !e.target.closest('#btn-theme')) {
      closeThemePicker();
    }
  });
}

// ========== 启动 ==========
document.addEventListener('DOMContentLoaded', init);
