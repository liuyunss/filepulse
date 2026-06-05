// ── 工具 ──
const $ = (id) => document.getElementById(id);
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fmtSize(b) {
    if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB';
    if (b >= 1048576) return (b / 1048576).toFixed(2) + ' MB';
    if (b >= 1024) return (b / 1024).toFixed(2) + ' KB';
    return b + ' B';
}
function log(msg) { const el = $('status-text'); if (el) el.textContent = msg; }

// ── 状态 ──
let currentFiles = [];
let folderPath = '';
let tableSort = { key: 'name', asc: true };
let previewSort = { key: 'name', asc: true };
let ready = false;

// ── Tauri API 适配层 ──
// Tauri v2 中 __TAURI__ 可能未注入但 __TAURI_INTERNALS__ 存在
// 多种方式尝试获取 invoke

let tauriInvoke = null;

function initTauri() {
    // 方式1: 标准 API
    if (window.__TAURI__?.core?.invoke) {
        tauriInvoke = window.__TAURI__.core.invoke;
        ready = true;
        log('就绪 ✓ (标准)');
        return;
    }
    // 方式2: 通过内部 API
    if (window.__TAURI_INTERNALS__?.invoke) {
        tauriInvoke = window.__TAURI_INTERNALS__.invoke;
        ready = true;
        log('就绪 ✓ (内部通道)');
        return;
    }
    // 方式3: 遍历 __TAURI_INTERNALS__ 查找 invoke
    const internals = window.__TAURI_INTERNALS__;
    if (internals) {
        // 尝试 ipc.invoke 或其他路径
        if (internals.ipc?.invoke) {
            tauriInvoke = internals.ipc.invoke;
            ready = true;
            log('就绪 ✓ (ipc通道)');
            return;
        }
        // 打印内部结构帮助调试
        const keys = Object.keys(internals).join(',');
        log('TAURI_INTERNALS keys: ' + keys);
    }
    ready = false;
    log('Tauri 未就绪。在浏览器中请用「选择文件夹」按钮');
}

function init() {
    initTauri();
    if (!ready) {
        // 浏览器模式：允许通过 webkitdirectory 选择文件夹
        log('浏览器模式 — 点击按钮选择文件夹');
    }
}

// ── 选择文件夹（Rust 弹原生对话框） ──
async function selectFolder() {
    if (!ready || !tauriInvoke) {
        // 浏览器模式
        const input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;
        input.onchange = (e) => {
            const files = e.target.files;
            if (!files?.length) return;
            const fn = files[0].webkitRelativePath.split('/')[0];
            $('folder-path').textContent = fn;
            currentFiles = Array.from(files).filter(f => f.name).map(f => ({
                name: f.name,
                path: f.webkitRelativePath,
                size: f.size,
                extension: f.name.includes('.') ? f.name.split('.').pop() : '',
                modified: f.lastModified ? new Date(f.lastModified).toISOString().slice(0,19).replace('T',' ') : ''
            }));
            folderPath = fn;
            renderTable();
            updateStatus();
            log('浏览器模式: 已加载 ' + currentFiles.length + ' 个文件');
        };
        input.click();
        return;
    }
    try {
        log('正在打开文件夹选择框...');
        const path = await tauriInvoke('pick_folder');
        if (path) {
            $('folder-path').textContent = path;
            $('folder-path').title = path;
            await scanFolder(path);
        } else {
            log('已取消');
        }
    } catch (e) {
        log('选择失败: ' + String(e));
    }
}

async function scanFolder(path) {
    try {
        log('正在扫描...');
        currentFiles = await tauriInvoke('scan_folder', { path });
        folderPath = path;
        renderTable();
        updateStatus();
        log('已加载 ' + currentFiles.length + ' 个文件');
    } catch (e) {
        log('扫描失败: ' + String(e));
    }
}

// ── 渲染 ──
function renderTable(files) {
    const data = files || currentFiles;
    const tbody = $('file-tbody');
    if (data.length === 0) {
        tbody.innerHTML = '';
        $('file-table').style.display = 'none';
        $('empty-state').style.display = 'flex';
        return;
    }
    $('file-table').style.display = '';
    $('empty-state').style.display = 'none';
    tbody.innerHTML = data.map(f => `
        <tr data-path="${escapeHtml(f.path)}">
            <td class="col-chk"><input type="checkbox" class="chk" data-path="${escapeHtml(f.path)}"></td>
            <td class="col-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</td>
            <td class="col-size">${fmtSize(f.size)}</td>
            <td class="col-type">${escapeHtml(f.extension || '-')}</td>
            <td class="col-date">${f.modified ? f.modified.slice(0,10) : ''}</td>
            <td class="col-path" title="${escapeHtml(f.path)}">${escapeHtml(f.path)}</td>
        </tr>
    `).join('');
}

function updateStatus() {
    $('file-count').textContent = currentFiles.length + ' 个文件';
    $('empty-state').style.display = currentFiles.length === 0 ? 'flex' : 'none';
    $('file-table').style.display = currentFiles.length === 0 ? 'none' : '';
}

// ── 排序 ──
function sortTable(key) {
    if (tableSort.key === key) { tableSort.asc = !tableSort.asc; }
    else { tableSort.key = key; tableSort.asc = true; }
    document.querySelectorAll('#file-table th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === key) th.classList.add(tableSort.asc ? 'sort-asc' : 'sort-desc');
    });
    renderTable(sortList(currentFiles, tableSort));
}
function sortList(list, { key, asc }) {
    return [...list].sort((a, b) => {
        let va = a[key] ?? '', vb = b[key] ?? '';
        if (key === 'size') { va = a.size; vb = b.size; }
        return (va < vb ? -1 : va > vb ? 1 : 0) * (asc ? 1 : -1);
    });
}

// ── 筛选 ──
function filterFiles() {
    return currentFiles.filter(f => {
        if ($('size-filter').checked) {
            const op = $('size-op').value, v = parseFloat($('size-value').value);
            if (isNaN(v)) return true;
            const unit = $('size-unit').value;
            let s = f.size / 1048576;
            if (unit === 'KB') s = f.size / 1024; else if (unit === 'GB') s = f.size / 1073741824;
            let m = op === 'gt' ? s > v : op === 'lt' ? s < v : Math.abs(s - v) < 0.001;
            if (!m) return false;
        }
        if ($('ext-filter').checked) {
            const exts = $('ext-value').value.split(',').map(e => e.trim().toLowerCase()).filter(e => e);
            if (!exts.includes('.' + (f.extension || '').toLowerCase())) return false;
        }
        if ($('date-filter').checked) {
            const days = parseInt($('date-value').value);
            if (isNaN(days)) return true;
            const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
            if (isNaN(new Date(f.modified).getTime()) || new Date(f.modified) < cutoff) return false;
        }
        return true;
    });
}
function applyFilters() {
    if (currentFiles.length === 0) { log('请先选择文件夹'); return; }
    const filtered = sortList(filterFiles(), tableSort);
    const set = new Set(filtered.map(f => f.path));
    document.querySelectorAll('#file-tbody tr').forEach(row => {
        row.style.display = set.has(row.dataset.path) ? '' : 'none';
    });
    $('filter-stats').textContent = '筛选：' + filtered.length + ' / ' + currentFiles.length;
}

// ── 预览弹窗 ──
function previewFiles() {
    if (currentFiles.length === 0) { alert('请先选择文件夹'); return; }
    const filtered = filterFiles();
    if (filtered.length === 0) { alert('没有匹配的文件'); return; }
    previewSort = { key: 'name', asc: true };
    renderPreview(sortList(filtered, previewSort));
    $('preview-overlay').classList.add('show');
    $('pv-select-all').checked = true;
    document.querySelectorAll('#preview-table th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === 'name') th.classList.add('sort-asc');
    });
}
function renderPreview(files) {
    $('preview-count').textContent = files.length;
    $('preview-tbody').innerHTML = files.map(f => `
        <tr data-path="${escapeHtml(f.path)}">
            <td class="pv-chk"><input type="checkbox" class="pv-chk-item" data-path="${escapeHtml(f.path)}" checked></td>
            <td class="pv-name">${escapeHtml(f.name)}</td>
            <td class="pv-size">${fmtSize(f.size)}</td>
            <td class="pv-type">${escapeHtml(f.extension || '-')}</td>
            <td class="pv-path">${escapeHtml(f.path)}</td>
        </tr>
    `).join('');
}
function sortPreview(key) {
    if (previewSort.key === key) { previewSort.asc = !previewSort.asc; }
    else { previewSort.key = key; previewSort.asc = true; }
    document.querySelectorAll('#preview-table th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === key) th.classList.add(previewSort.asc ? 'sort-asc' : 'sort-desc');
    });
    renderPreview(sortList(filterFiles(), previewSort));
}
function closePreview() { $('preview-overlay').classList.remove('show'); }

// ── 确认删除 ──
async function confirmDelete() {
    const checked = Array.from(document.querySelectorAll('.pv-chk-item:checked')).map(cb => cb.dataset.path);
    if (checked.length === 0) { alert('请勾选文件'); return; }
    if (!confirm('⚠️ 将真正删除以下 ' + checked.length + ' 个文件！\n\n位置: ' + folderPath + '\n\n继续？')) return;
    try {
        log('正在删除...');
        const deleted = await tauriInvoke('delete_files', { paths: checked, baseDir: folderPath });
        log('已删除 ' + deleted + ' 个文件，正在刷新...');
        await scanFolder(folderPath);
    } catch (e) {
        alert('删除失败: ' + e);
        log('删除失败');
    }
    closePreview();
}

// ── 空文件 ──
let emptyFiles = [];
function scanEmpty() {
    if (currentFiles.length === 0) { alert('请先选择文件夹'); return; }
    const exts = $('empty-ext-value').value.split(',').map(e => e.trim().toLowerCase()).filter(e => e);
    if (!exts.length) { alert('请输入后缀'); return; }
    emptyFiles = currentFiles.filter(f => f.size === 0 && exts.includes('.' + (f.extension || '').toLowerCase()));
    const pv = $('empty-cleanup-preview');
    if (!emptyFiles.length) {
        $('empty-cleanup-count').textContent = '未找到';
        $('empty-cleanup-list').innerHTML = ''; pv.style.display = 'block'; $('btn-delete-empty').disabled = true;
        return;
    }
    const map = {};
    emptyFiles.forEach(f => {
        const fp = f.path.split('/').slice(0, -1).join('/') || '(根目录)';
        (map[fp] = map[fp] || []).push(f);
    });
    $('empty-cleanup-count').textContent = '找到 ' + emptyFiles.length + ' 个空文件';
    $('empty-cleanup-list').innerHTML = Object.keys(map).sort().map(folder => `
        <div style="margin:6px 0"><b>${escapeHtml(folder)}</b></div>
        ${map[folder].map(f => `
            <label style="display:block;font-size:11px;color:#64748B;margin-left:12px;">
                <input type="checkbox" class="ef-chk" data-path="${escapeHtml(f.path)}" checked> ${escapeHtml(f.name)} (0 KB)
            </label>
        `).join('')}
    `).join('');
    pv.style.display = 'block'; $('btn-delete-empty').disabled = false;
}
async function deleteEmpty() {
    const paths = Array.from(document.querySelectorAll('.ef-chk:checked')).map(cb => cb.dataset.path);
    if (!paths.length) { alert('请勾选'); return; }
    if (!confirm('删除 ' + paths.length + ' 个空文件？位置: ' + folderPath)) return;
    await tauriInvoke('delete_files', { paths, baseDir: folderPath });
    await scanFolder(folderPath);
    scanEmpty();
}

// ── 解散 ──
function previewDissolve() {
    if (currentFiles.length === 0) { alert('请先选择文件夹'); return; }
    $('dissolve-preview').innerHTML = '<b>解散预览</b><pre style="font-size:11px;margin-top:4px;">test/\n├── docs/\n│   └── sub/\n│       └── note.txt\n└── video/\n    └── movie.mp4</pre><div style="color:#DC2626;margin-top:4px;">将删除空文件夹：sub/</div>';
    $('dissolve-preview').style.display = 'block';
}

// ── 规则 ──
function getRules() { try { return JSON.parse(localStorage.getItem('filepulse_rules') || '[]'); } catch { return []; } }
function saveRule(name) {
    getRules().push({ name, conditions: {
        size: $('size-filter').checked, sizeOp: $('size-op').value, sizeValue: $('size-value').value, sizeUnit: $('size-unit').value,
        ext: $('ext-filter').checked, extValue: $('ext-value').value,
        date: $('date-filter').checked, dateValue: $('date-value').value
    }});
    localStorage.setItem('filepulse_rules', JSON.stringify(getRules()));
    renderRules(); alert('已保存：' + name);
}
function renderRules() {
    $('rules-list').innerHTML = getRules().map((r, i) =>
        `<label><input type="checkbox" class="rule-chk" data-index="${i}"> ${escapeHtml(r.name)}</label>`).join('');
}

// ── Tab ──
function switchTab(name) {
    document.querySelectorAll('.tools-tabs .tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector('.tab[data-tab="' + name + '"]');
    if (activeTab) activeTab.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(p => p.style.display = 'none');
    const content = $('tab-' + name);
    if (content) content.style.display = '';
}

// ── 拖拽处理 ──
function setupDragDrop() {
    // 方式1: Tauri 原生拖拽事件
    if (ready && window.__TAURI__.event) {
        try {
            window.__TAURI__.event.listen('tauri://drag-drop', (e) => {
                const paths = e.payload?.paths;
                if (paths && paths.length > 0) {
                    const p = paths[0];
                    $('folder-path').textContent = p;
                    $('folder-path').title = p;
                    scanFolder(p);
                }
            });
            // 也监听 tauri:// 开头的其他拖拽事件
            window.__TAURI__.event.listen('tauri://file-drop', (e) => {
                const paths = e.payload?.paths;
                if (paths && paths.length > 0) {
                    $('folder-path').textContent = paths[0];
                    scanFolder(paths[0]);
                }
            });
        } catch (e) { /* 忽略，用浏览器拖拽兜底 */ }
    }

    // 方式2: 浏览器级拖拽兜底
    let dc = 0;
    document.addEventListener('dragenter', e => { e.preventDefault(); e.stopPropagation(); dc++; document.body.classList.add('drag-over'); });
    document.addEventListener('dragleave', e => { e.preventDefault(); e.stopPropagation(); dc--; if (dc <= 0) { dc = 0; document.body.classList.remove('drag-over'); } });
    document.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); });
    document.addEventListener('drop', async e => {
        e.preventDefault(); e.stopPropagation(); dc = 0; document.body.classList.remove('drag-over');

        // 浏览器模式：拖入文件直接处理
        if (!ready) {
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                const fn = files[0].webkitRelativePath || '';
                const folder = fn ? fn.split('/')[0] : '拖入文件';
                $('folder-path').textContent = folder;
                currentFiles = Array.from(files).filter(f => f.name).map(f => ({
                    name: f.name,
                    path: f.webkitRelativePath || f.name,
                    size: f.size,
                    extension: f.name.includes('.') ? f.name.split('.').pop() : '',
                    modified: f.lastModified ? new Date(f.lastModified).toISOString().slice(0,19).replace('T',' ') : ''
                }));
                folderPath = folder;
                renderTable();
                updateStatus();
                log('已加载 ' + currentFiles.length + ' 个文件');
                return;
            }
            alert('浏览器不支持拖入文件夹，请点击「选择文件夹」按钮');
            return;
        }

        // Tauri 模式：弹原生对话框
        await selectFolder();
    });
}

// ── DOM就绪 ──
document.addEventListener('DOMContentLoaded', () => {
    init();
    setupDragDrop();

    $('btn-open').addEventListener('click', selectFolder);
    $('btn-preview').addEventListener('click', previewFiles);
    $('btn-delete').addEventListener('click', () => {
        if (currentFiles.length === 0) { alert('请先选择文件夹'); return; }
        previewFiles();
    });
    $('btn-close-preview').addEventListener('click', closePreview);
    $('btn-cancel-preview').addEventListener('click', closePreview);
    $('btn-confirm-preview').addEventListener('click', confirmDelete);
    $('pv-select-all').addEventListener('change', e => {
        document.querySelectorAll('.pv-chk-item').forEach(cb => cb.checked = e.target.checked);
    });

    document.querySelectorAll('#file-table th.sortable').forEach(th => {
        th.addEventListener('click', () => sortTable(th.dataset.sort));
    });
    document.querySelectorAll('#preview-table th.sortable').forEach(th => {
        th.addEventListener('click', () => sortPreview(th.dataset.sort));
    });

    $('btn-advanced').addEventListener('click', () => {
        const p = $('tools-panel');
        p.style.display = (p.style.display === 'none' || p.style.display === '') ? '' : 'none';
    });
    $('btn-close-tools').addEventListener('click', () => $('tools-panel').style.display = 'none');
    document.querySelectorAll('.tools-tabs .tab').forEach(t => {
        t.addEventListener('click', () => switchTab(t.dataset.tab));
    });

    $('btn-scan-empty').addEventListener('click', scanEmpty);
    $('btn-delete-empty').addEventListener('click', deleteEmpty);
    $('btn-preview-dissolve').addEventListener('click', previewDissolve);

    $('btn-save-rule').addEventListener('click', () => { const n = prompt('规则名称：'); if (n) saveRule(n); });
    $('btn-delete-rule').addEventListener('click', () => {
        const chk = document.querySelector('.rule-chk:checked');
        if (!chk) return alert('请选择规则');
        const i = parseInt(chk.dataset.index);
        if (isNaN(i)) return;
        const rules = getRules();
        if (confirm('删除 "' + rules[i].name + '"？')) { rules.splice(i, 1); localStorage.setItem('filepulse_rules', JSON.stringify(rules)); renderRules(); }
    });

    $('select-all').addEventListener('change', e => {
        document.querySelectorAll('.chk').forEach(cb => {
            if (cb.closest('tr')?.style.display !== 'none') cb.checked = e.target.checked;
        });
    });
    $('file-tbody').addEventListener('click', e => {
        const row = e.target.closest('tr');
        const cb = row?.querySelector('.chk');
        if (cb && e.target !== cb) cb.checked = !cb.checked;
    });
    $('filter-bar').querySelectorAll('input, select').forEach(el => {
        el.addEventListener('change', () => { if (currentFiles.length) applyFilters(); });
    });

    updateStatus();
    $('file-table').style.display = 'none';
    renderRules();
});
