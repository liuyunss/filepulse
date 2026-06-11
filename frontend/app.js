// ═══════════════════════════════════════════════
// FilePulse — Standalone Prototype (matches Vue 3 version)
// ═══════════════════════════════════════════════

const $ = (id) => document.getElementById(id);

// ── Tauri API ──
let tauriInvoke = null;
let tauriOpen = null;

async function initTauri() {
    try {
        const core = await import('https://unpkg.com/@tauri-apps/api/core');
        tauriInvoke = core.invoke;
        const dialog = await import('https://unpkg.com/@tauri-apps/plugin-dialog');
        tauriOpen = dialog.open;
    } catch {
        // Fallback: try window.__TAURI__
        if (window.__TAURI__) {
            tauriInvoke = window.__TAURI__.core?.invoke || window.__TAURI__.invoke;
            tauriOpen = window.__TAURI__.dialog?.open;
        }
    }
}

// ── State ──
const TYPE_COLORS = {
    image:'#52c41a', video:'#ff4d4f', audio:'#722ed1',
    doc:'#1890ff', archive:'#fa8c16', code:'#0ea5e9', exe:'#8c8c8c', folder:'#d9d9d9',
};

const EXT_MAP = {
    jpg:'image',jpeg:'image',png:'image',gif:'image',bmp:'image',svg:'image',webp:'image',ico:'image',
    mp4:'video',avi:'video',mkv:'video',mov:'video',wmv:'video',flv:'video',webm:'video',
    mp3:'audio',wav:'audio',flac:'audio',aac:'audio',ogg:'audio',wma:'audio',m4a:'audio',
    pdf:'doc',doc:'doc',docx:'doc',xls:'doc',xlsx:'doc',ppt:'doc',pptx:'doc',txt:'doc',md:'doc',
    zip:'archive',rar:'archive','7z':'archive',tar:'archive',gz:'archive',bz2:'archive',
    js:'code',ts:'code',py:'code',java:'code',cpp:'code',rs:'code',go:'code',vue:'code',html:'code',css:'code',
    exe:'exe',msi:'exe',bat:'exe',sh:'exe',apk:'exe',app:'exe',
};

const PREVIEWABLE = new Set(['jpg','jpeg','png','gif','bmp','svg','webp','ico','mp4','avi','mkv','mov','webm']);
const IMG_EXTS = new Set(['jpg','jpeg','png','gif','bmp','svg','webp','ico']);

let state = {
    files: [],
    currentPath: '',
    selectedPaths: new Set(),
    loading: false,
    previewMode: false,
    sortKey: 'name',
    sortAsc: true,
    // Filters
    filters: [
        { filter_type:'name', enabled:false, operator:'contains', value:'', negate:false },
        { filter_type:'extension', enabled:false, value:'', negate:false },
        { filter_type:'size', enabled:false, operator:'>', value:'', unit:'MB', negate:false },
        { filter_type:'date', enabled:false, operator:'recent', value:'', unit:'day', negate:false },
    ],
    // Tools
    deleteEmpty: false,
    dissolveMode: false,
    keepLevels: 1,
    dedupeMode: false,
    rotateMode: false,
    rotateDir: 'cw',
    rotateAngle: 90,
    // Rules
    rules: [],
    // UI
    filterEdit: false,
    ruleEdit: false,
    hoverFilterIdx: -1,
};

// ── Helpers ──
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function fmtSize(b) {
    if (b === 0) return '0';
    const u = ['','K','M','G','T'];
    const i = Math.floor(Math.log(b) / Math.log(1024));
    return (i > 0 ? (b / Math.pow(1024, i)).toFixed(1) : b.toFixed(0)) + ' ' + u[i];
}
function fileColor(file) {
    if (file.is_dir) return TYPE_COLORS.folder;
    return TYPE_COLORS[EXT_MAP[file.extension?.toLowerCase()]] || '#d9d9d9';
}
function relPath(fullPath) {
    if (!state.currentPath) return fullPath;
    const root = state.currentPath.replace(/\\/g, '/').replace(/\/$/, '');
    const fp = fullPath.replace(/\\/g, '/');
    if (fp.startsWith(root + '/')) return fp.slice(root.length + 1);
    if (fp === root) return '';
    return fp;
}
function typeLabel(t) { return {name:'名称',extension:'后缀',size:'大小',date:'日期'}[t] || t; }
function ruleSummary(rule) {
    const active = rule.filters.filter(f => f.enabled);
    if (active.length === 0) return '无条件';
    return active.map(f => {
        const l = typeLabel(f.filter_type);
        switch (f.filter_type) {
            case 'name': return `${l}:${f.operator==='contains'?'含':f.operator==='prefix'?'前':'后'}${f.value}`;
            case 'extension': return `${l}:${f.value||'*'}`;
            case 'size': return `${l}${f.operator}${f.value}${f.unit}`;
            case 'date': return `${l}:${f.operator==='recent'?'近':'早'}${f.value}${f.unit}`;
            default: return l;
        }
    }).join(' / ');
}

// ── Filter matching ──
function matchesFilters(file) {
    for (const f of state.filters) {
        if (!f.enabled) continue;
        let match = false;
        switch (f.filter_type) {
            case 'name': {
                const val = (f.value || '').toLowerCase();
                const name = (file.name || '').toLowerCase();
                if (f.operator === 'contains') match = name.includes(val);
                else if (f.operator === 'prefix') match = name.startsWith(val);
                else if (f.operator === 'suffix') match = name.endsWith(val);
                break;
            }
            case 'extension': {
                const exts = (f.value || '').split(',').map(e => e.trim().toLowerCase().replace('.',''));
                match = exts.includes((file.extension || '').toLowerCase());
                break;
            }
            case 'size': {
                if (!f.value || f.value === '0') { match = false; break; }
                const num = parseFloat(f.value) || 0;
                const threshold = f.unit === 'KB' ? num*1024 : f.unit === 'GB' ? num*1024*1024*1024 : num*1024*1024;
                if (f.operator === '>') match = file.size > threshold;
                else if (f.operator === '<') match = file.size < threshold;
                else if (f.operator === '=') match = Math.abs(file.size - threshold) < 1024;
                break;
            }
            case 'date': {
                const fileDate = new Date(file.modified);
                const now = new Date();
                const val = parseInt(f.value || '0');
                const ms = f.unit === 'hour' ? val*3600000 : f.unit === 'month' ? val*30*86400000 : val*86400000;
                if (f.operator === 'recent') match = (now - fileDate) < ms;
                else if (f.operator === 'before') match = (now - fileDate) > ms;
                break;
            }
        }
        if (f.negate) match = !match;
        if (!match) return false;
    }
    return true;
}

function getFilteredFiles() {
    let result = state.files.filter(f => !f.is_dir);
    if (state.previewMode) result = result.filter(matchesFilters);
    result.sort((a, b) => {
        let cmp = 0;
        switch (state.sortKey) {
            case 'name': cmp = a.name.localeCompare(b.name); break;
            case 'size': cmp = a.size - b.size; break;
            case 'modified': cmp = (a.modified||'').localeCompare(b.modified||''); break;
            case 'extension': cmp = (a.extension||'').localeCompare(b.extension||''); break;
        }
        return state.sortAsc ? cmp : -cmp;
    });
    return result;
}

// ── Dialog ──
let dlgResolve = null;
function showDialog({ title, message, list, kind, confirmText, cancelText, showCancel, wide }) {
    return new Promise(resolve => {
        dlgResolve = resolve;
        $('dlg-title').textContent = title || '';
        $('dlg-message').textContent = message || '';
        $('dlg-message').style.display = message ? '' : 'none';
        const listEl = $('dlg-list');
        listEl.innerHTML = '';
        if (list && list.length) {
            list.forEach(item => { const li = document.createElement('li'); li.textContent = item; listEl.appendChild(li); });
            listEl.style.display = '';
        } else { listEl.style.display = 'none'; }
        $('dlg-thumbs').innerHTML = '';
        const confirmBtn = $('dlg-confirm');
        confirmBtn.textContent = confirmText || '确认';
        confirmBtn.className = 'dlg-btn dlg-btn--confirm' + ((kind === 'danger' || kind === 'warning') ? ' dlg-btn--danger' : '');
        $('dlg-cancel').textContent = cancelText || '取消';
        $('dlg-cancel').style.display = showCancel === false ? 'none' : '';
        $('dlg-overlay').style.display = '';
    });
}
function closeDlg(v) { $('dlg-overlay').style.display = 'none'; dlgResolve?.(v); dlgResolve = null; }

// ── Render ──
function renderFilters() {
    const list = $('filter-list');
    const empty = $('filter-empty');
    const toolActive = state.deleteEmpty || state.dissolveMode || state.rotateMode || state.dedupeMode;
    $('filter-section').classList.toggle('disabled', toolActive);
    $('rule-section').classList.toggle('disabled', toolActive);

    if (state.filters.length === 0) { list.innerHTML = ''; empty.style.display = ''; return; }
    empty.style.display = 'none';
    list.innerHTML = state.filters.map((f, i) => {
        const color = {name:'#1890ff',extension:'#52c41a',size:'#fa8c16',date:'#8b5cf6'}[f.filter_type] || '#999';
        const editing = state.filterEdit && state.hoverFilterIdx === i;
        let controls = '';
        if (f.filter_type === 'name') {
            controls = `
                <select class="sel f-op" data-i="${i}" ${toolActive?'disabled':''}>
                    <option value="contains" ${f.operator==='contains'?'selected':''}>包含</option>
                    <option value="prefix" ${f.operator==='prefix'?'selected':''}>前缀</option>
                    <option value="suffix" ${f.operator==='suffix'?'selected':''}>后缀</option>
                </select>
                <input class="inp" data-i="${i}" data-field="value" value="${escapeHtml(f.value||'')}" placeholder="关键词" ${toolActive?'disabled':''} />`;
        } else if (f.filter_type === 'extension') {
            controls = `
                <select class="sel f-ext-cat" data-i="${i}" ${toolActive?'disabled':''}>
                    <option value="">分类</option>
                    <option value=".jpg,.jpeg,.png,.gif,.bmp,.svg,.webp,.ico">图片</option>
                    <option value=".mp4,.avi,.mkv,.mov,.wmv,.flv,.webm">视频</option>
                    <option value=".mp3,.wav,.flac,.aac,.ogg,.wma,.m4a">音频</option>
                    <option value=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md">文档</option>
                    <option value=".zip,.rar,.7z,.tar,.gz,.bz2">压缩包</option>
                    <option value=".js,.ts,.py,.java,.cpp,.rs,.go,.vue,.html,.css">代码</option>
                    <option value=".exe,.msi,.bat,.sh,.apk,.app">可执行</option>
                </select>
                <input class="inp" data-i="${i}" data-field="value" value="${escapeHtml(f.value||'')}" placeholder=".log,.tmp" ${toolActive?'disabled':''} />`;
        } else if (f.filter_type === 'size') {
            controls = `
                <select class="sel f-op" data-i="${i}" ${toolActive?'disabled':''}>
                    <option value=">" ${f.operator==='>'?'selected':''}>&gt;</option>
                    <option value="<" ${f.operator==='<'?'selected':''}>&lt;</option>
                    <option value="=" ${f.operator==='='?'selected':''}>=</option>
                </select>
                <input class="inp-s" data-i="${i}" data-field="value" type="number" value="${f.value||''}" placeholder="10" ${toolActive?'disabled':''} />
                <select class="sel f-unit" data-i="${i}" ${toolActive?'disabled':''}>
                    <option value="KB" ${f.unit==='KB'?'selected':''}>KB</option>
                    <option value="MB" ${f.unit==='MB'?'selected':''}>MB</option>
                    <option value="GB" ${f.unit==='GB'?'selected':''}>GB</option>
                </select>`;
        } else if (f.filter_type === 'date') {
            controls = `
                <select class="sel f-op" data-i="${i}" ${toolActive?'disabled':''}>
                    <option value="recent" ${f.operator==='recent'?'selected':''}>最近</option>
                    <option value="before" ${f.operator==='before'?'selected':''}>早于</option>
                </select>
                <input class="inp-xs" data-i="${i}" data-field="value" type="number" value="${f.value||''}" placeholder="7" ${toolActive?'disabled':''} />
                <select class="sel f-unit" data-i="${i}" ${toolActive?'disabled':''}>
                    <option value="day" ${f.unit==='day'?'selected':''}>天</option>
                    <option value="hour" ${f.unit==='hour'?'selected':''}>时</option>
                    <option value="month" ${f.unit==='month'?'selected':''}>月</option>
                </select>`;
        }
        return `<div class="filter-line" data-i="${i}" style="border-left-color:${color}">
            <span class="f-badge ${editing?'hide':''}" style="background:${color}">${typeLabel(f.filter_type)}</span>
            <label class="f-toggle"><input type="checkbox" class="f-enabled" data-i="${i}" ${f.enabled?'checked':''} ${toolActive?'disabled':''} /></label>
            ${controls}
            <label class="negate"><input type="checkbox" class="f-negate" data-i="${i}" ${f.negate?'checked':''} ${toolActive?'disabled':''} /> 取反</label>
            ${editing ? `<button class="del-btn" data-del="${i}">✕</button>` : ''}
        </div>`;
    }).join('');

    // Bind events
    list.querySelectorAll('.f-enabled').forEach(el => {
        el.addEventListener('change', () => { state.filters[+el.dataset.i].enabled = el.checked; renderTable(); });
    });
    list.querySelectorAll('.f-negate').forEach(el => {
        el.addEventListener('change', () => { state.filters[+el.dataset.i].negate = el.checked; renderTable(); });
    });
    list.querySelectorAll('.f-op').forEach(el => {
        el.addEventListener('change', () => { state.filters[+el.dataset.i].operator = el.value; renderTable(); });
    });
    list.querySelectorAll('.f-unit').forEach(el => {
        el.addEventListener('change', () => { state.filters[+el.dataset.i].unit = el.value; renderTable(); });
    });
    list.querySelectorAll('.f-ext-cat').forEach(el => {
        el.addEventListener('change', () => { state.filters[+el.dataset.i].value = el.value; renderFilters(); renderTable(); });
    });
    list.querySelectorAll('input[data-field]').forEach(el => {
        el.addEventListener('input', () => { state.filters[+el.dataset.i].value = el.value; renderTable(); });
    });
    list.querySelectorAll('.del-btn').forEach(el => {
        el.addEventListener('click', () => { state.filters.splice(+el.dataset.del, 1); renderFilters(); renderTable(); });
    });
    list.querySelectorAll('.filter-line').forEach(el => {
        el.addEventListener('mouseenter', () => { state.hoverFilterIdx = +el.dataset.i; });
        el.addEventListener('mouseleave', () => { state.hoverFilterIdx = -1; renderFilters(); });
    });
}

function renderRules() {
    const list = $('rule-list');
    const empty = $('rule-empty');
    if (state.rules.length === 0) { list.innerHTML = ''; empty.style.display = ''; return; }
    empty.style.display = 'none';
    list.innerHTML = state.rules.map((r, idx) => {
        const editing = state.ruleEdit;
        return `<div class="rule-line ${editing?'editing':''}">
            <span class="r-num">${idx+1}</span>
            <span class="r-name">${escapeHtml(r.name)}</span>
            <span class="r-summary" title="${escapeHtml(ruleSummary(r))}">${escapeHtml(ruleSummary(r))}</span>
            <button class="rule-load-btn" data-load="${idx}">加载</button>
            ${editing ? `<button class="rule-del-btn" data-del="${r.id}">✕</button>` : ''}
        </div>`;
    }).join('');
    list.querySelectorAll('.rule-load-btn').forEach(el => {
        el.addEventListener('click', () => {
            const rule = state.rules[+el.dataset.load];
            state.filters = JSON.parse(JSON.stringify(rule.filters));
            state.previewMode = true;
            renderFilters(); renderTable();
        });
    });
    list.querySelectorAll('.rule-del-btn').forEach(el => {
        el.addEventListener('click', async () => {
            state.rules = state.rules.filter(r => r.id !== el.dataset.del);
            if (tauriInvoke) await tauriInvoke('save_rules', { rules: state.rules });
            renderRules();
        });
    });
}

function renderTable() {
    const filtered = getFilteredFiles();
    const all = state.files.filter(f => !f.is_dir);
    const selectedCount = state.selectedPaths.size;
    const totalCount = all.length;

    $('stat-selected').textContent = selectedCount;
    $('stat-filtered').textContent = state.previewMode ? filtered.length : totalCount;
    $('stat-total').textContent = totalCount;
    $('btn-delete').disabled = selectedCount === 0;
    const badge = $('delete-badge');
    if (selectedCount > 0) { badge.textContent = selectedCount; badge.style.display = ''; }
    else { badge.style.display = 'none'; }

    const tbody = $('file-tbody');
    tbody.innerHTML = filtered.map(f => {
        const sel = state.selectedPaths.has(f.path);
        const ext = (f.extension || '').toUpperCase() || '-';
        const isDir = f.is_dir;
        const color = fileColor(f);
        const canPreview = PREVIEWABLE.has((f.extension||'').toLowerCase());
        return `<tr class="${sel?'selected':''}" data-path="${escapeHtml(f.path)}">
            <td class="col-check" style="border-left-color:${color}"><input type="checkbox" class="row-cb" data-path="${escapeHtml(f.path)}" ${sel?'checked':''} /></td>
            <td class="col-path"><span class="path-text" title="${escapeHtml(relPath(f.path))}">${escapeHtml(relPath(f.path))}</span></td>
            <td class="col-size">${fmtSize(f.size)}</td>
            <td class="col-type"><span class="type-tag" style="background:${color};color:#fff">${isDir?'文件夹':ext}</span></td>
            <td class="col-date" title="${escapeHtml(f.modified||'')}">${escapeHtml(f.modified||'')}</td>
            <td class="col-action">
                ${canPreview ? `<button class="row-btn row-preview" data-path="${escapeHtml(f.path)}" data-ext="${escapeHtml(f.extension||'')}" title="预览"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>` : ''}
                <button class="row-btn row-reveal" data-path="${escapeHtml(f.path)}" title="打开位置"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg></button>
            </td>
        </tr>`;
    }).join('');

    // Bind row events
    tbody.querySelectorAll('tr').forEach(tr => {
        tr.addEventListener('click', (e) => {
            if (e.target.closest('input') || e.target.closest('.row-btn')) return;
            toggleSelect(tr.dataset.path);
        });
    });
    tbody.querySelectorAll('.row-cb').forEach(cb => {
        cb.addEventListener('change', () => toggleSelect(cb.dataset.path));
    });
    tbody.querySelectorAll('.row-preview').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openPreview(btn.dataset.path, btn.dataset.ext);
        });
    });
    tbody.querySelectorAll('.row-reveal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (tauriInvoke) tauriInvoke('show_in_folder', { path: btn.dataset.path });
        });
    });

    // Sort header arrows
    document.querySelectorAll('.file-table th.sortable').forEach(th => {
        const key = th.dataset.sort;
        const arr = th.querySelector('.arr');
        if (arr) arr.textContent = state.sortKey === key ? (state.sortAsc ? '↑' : '↓') : '';
    });
}

function toggleSelect(path) {
    if (state.selectedPaths.has(path)) state.selectedPaths.delete(path);
    else state.selectedPaths.add(path);
    renderTable();
}

function updateView() {
    const hasFiles = state.files.length > 0;
    $('empty-state').style.display = hasFiles ? 'none' : '';
    $('table-area').style.display = hasFiles ? '' : 'none';
    $('status-path').textContent = state.currentPath || '未选择文件夹';
    $('btn-clear').style.display = state.currentPath ? '' : 'none';
    renderTable();
}

// ── Preview ──
function openPreview(path, ext) {
    const isImg = IMG_EXTS.has((ext||'').toLowerCase());
    const overlay = $('preview-overlay');
    const img = $('preview-img');
    const video = $('preview-video');
    img.style.display = 'none';
    video.style.display = 'none';
    try {
        const url = path.replace(/\\/g, '/');
        if (isImg) { img.src = 'asset://localhost/' + encodeURIComponent(url); img.style.display = ''; }
        else { video.src = 'asset://localhost/' + encodeURIComponent(url); video.style.display = ''; }
    } catch {}
    overlay.style.display = '';
}

// ── Actions ──
async function scanFolder(path) {
    state.loading = true;
    $('loading-overlay').style.display = '';
    try {
        const result = await tauriInvoke('scan_files', { options: { path, recursive: true } });
        state.files = result || [];
        state.currentPath = path;
        state.selectedPaths.clear();
        state.previewMode = false;
    } catch (e) { console.error('Scan failed:', e); state.files = []; }
    state.loading = false;
    $('loading-overlay').style.display = 'none';
    updateView();
    renderFilters();
}

async function handleDelete() {
    const count = state.selectedPaths.size;
    if (count === 0) return;
    const ok = await showDialog({
        title: '删除确认',
        message: `确认删除选中的 ${count} 个文件？\n文件将移至回收站，可手动恢复。`,
        kind: 'danger', confirmText: '确认删除', cancelText: '取消',
    });
    if (!ok) return;
    try {
        const paths = Array.from(state.selectedPaths);
        const result = await tauriInvoke('delete_files', { paths });
        const deletedSet = new Set(result.deleted);
        state.files = state.files.filter(f => !deletedSet.has(f.path));
        state.selectedPaths.clear();
    } catch (e) { console.error('Delete failed:', e); }
    updateView();
}

async function handlePreviewAction() {
    // Dissolve mode
    if (state.dissolveMode) {
        state.loading = true; $('loading-overlay').style.display = '';
        try {
            const preview = await tauriInvoke('dissolve_folder', { path: state.currentPath, keepLevels: state.keepLevels, dryRun: true });
            state.loading = false; $('loading-overlay').style.display = 'none';
            if (!preview || preview.length === 0) { await showDialog({ title:'解散文件夹', message:'没有需要解散的文件。', showCancel:false }); return; }
            const moves = preview.filter(r => r.action === 'move');
            const skips = preview.filter(r => r.action === 'skip');
            const items = [...moves.map(r=>`${r.name}  →  ${r.target}`), ...skips.map(r=>`${r.name}  ⤏ 跳过（重复文件）`)];
            const ok = await showDialog({ title:`解散文件夹 · ${moves.length} 个移动`+(skips.length?` · ${skips.length} 个跳过`:''), message:'以下文件将被移动：', list:items, kind:'warning', confirmText:'执行解散' });
            if (ok) {
                state.loading = true; $('loading-overlay').style.display = '';
                const results = await tauriInvoke('dissolve_folder', { path: state.currentPath, keepLevels: state.keepLevels, dryRun: false });
                state.loading = false; $('loading-overlay').style.display = 'none';
                await scanFolder(state.currentPath);
                await showDialog({ title:'解散完成', message:`成功移动 ${results.filter(r=>r.action==='move').length} 个文件`, showCancel:false });
            }
        } catch(e) { state.loading=false; $('loading-overlay').style.display='none'; console.error(e); }
        return;
    }
    // Delete empty dirs
    if (state.deleteEmpty) {
        state.loading = true; $('loading-overlay').style.display = '';
        try {
            const result = await tauriInvoke('delete_empty_dirs', { root: state.currentPath, dryRun: false });
            state.loading = false; $('loading-overlay').style.display = 'none';
            const total = result.deleted.length + result.failed.length;
            if (total === 0) await showDialog({ title:'删除空文件夹', message:'没有找到空文件夹', showCancel:false });
            else await showDialog({ title:'删除空文件夹', message:`已删除 ${result.deleted.length} 个空文件夹`+(result.failed.length?`\n${result.failed.length} 个删除失败`:''), showCancel:false });
            await scanFolder(state.currentPath);
        } catch(e) { state.loading=false; $('loading-overlay').style.display='none'; console.error(e); }
        return;
    }
    // Rotate
    if (state.rotateMode) {
        if (state.selectedPaths.size === 0) { await showDialog({ title:'旋转图片', message:'请先在列表中选中要旋转的图片', showCancel:false }); return; }
        await showDialog({ title:'旋转图片', message:`将 ${state.rotateDir==='cw'?'顺时针':'逆时针'} ${state.rotateAngle}° 旋转选中的图片`, kind:'warning', confirmText:'确认旋转' });
        // Rotation logic would call rotate_file for each selected jpeg/mp4/mov
        return;
    }
    // Dedupe
    if (state.dedupeMode) {
        state.loading = true; $('loading-overlay').style.display = '';
        try {
            const groups = await tauriInvoke('find_duplicates', { root: state.currentPath });
            state.loading = false; $('loading-overlay').style.display = 'none';
            if (!groups || groups.length === 0) { await showDialog({ title:'查找重复文件', message:'没有发现重复文件', showCancel:false }); return; }
            const totalFiles = groups.reduce((s,g) => s + g.files.length, 0);
            const items = groups.map(g => `[${fmtSize(g.size)}] ${g.files.map(f=>relPath(f.path)).join('  =  ')}`);
            const ok = await showDialog({ title:`重复文件 · ${groups.length} 组 · ${totalFiles} 个文件`, message:'每组选择保留最新或最旧的文件：', list:items, kind:'warning', confirmText:'保留最新的', cancelText:'保留最旧的' });
            // Delete duplicates based on choice
            const keepNewest = ok;
            const toDelete = [];
            for (const g of groups) {
                const sorted = [...g.files].sort((a,b) => {
                    const d = (a.modified||'').localeCompare(b.modified||'');
                    return keepNewest ? -d : (d !== 0 ? d : a.path.length - b.path.length);
                });
                toDelete.push(...sorted.slice(1).map(f=>f.path));
            }
            if (toDelete.length) {
                await tauriInvoke('delete_duplicates', { action: { deletePaths: toDelete } });
                await scanFolder(state.currentPath);
                await showDialog({ title:'去重完成', message:`删除了 ${toDelete.length} 个重复文件，保留了 ${groups.length} 个文件`, showCancel:false });
            }
        } catch(e) { state.loading=false; $('loading-overlay').style.display='none'; console.error(e); }
        return;
    }
    // Normal filter toggle
    state.previewMode = !state.previewMode;
    renderTable();
}

// ── Bind UI Events ──
function bindEvents() {
    // Open folder
    $('btn-open').addEventListener('click', async () => {
        if (tauriOpen) {
            const selected = await tauriOpen({ directory: true, multiple: false });
            if (selected) scanFolder(selected);
        }
    });
    $('import-zone').addEventListener('click', () => $('btn-open').click());

    // Delete
    $('btn-delete').addEventListener('click', handleDelete);

    // Preview / tool action
    $('btn-preview').addEventListener('click', handlePreviewAction);

    // Select all
    $('select-all').addEventListener('change', (e) => {
        const filtered = getFilteredFiles();
        if (state.selectedPaths.size === filtered.length) state.selectedPaths.clear();
        else state.selectedPaths = new Set(filtered.map(f => f.path));
        renderTable();
    });

    // Sort headers
    document.querySelectorAll('.file-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            if (state.sortKey === key) state.sortAsc = !state.sortAsc;
            else { state.sortKey = key; state.sortAsc = true; }
            renderTable();
        });
    });

    // Clear list
    $('btn-clear').addEventListener('click', () => {
        state.files = []; state.currentPath = ''; state.selectedPaths.clear(); state.previewMode = false;
        updateView(); renderFilters();
    });

    // Filter add panel
    $('btn-add-filter').addEventListener('click', () => {
        const panel = $('add-panel');
        panel.style.display = panel.style.display === 'none' ? '' : 'none';
    });
    document.querySelectorAll('#add-panel .type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            const base = { filter_type: type, enabled: true, negate: false };
            if (type === 'name') state.filters.push({ ...base, operator:'contains', value:'' });
            else if (type === 'extension') state.filters.push({ ...base, value:'' });
            else if (type === 'size') state.filters.push({ ...base, operator:'>', value:'', unit:'MB' });
            else if (type === 'date') state.filters.push({ ...base, operator:'recent', value:'', unit:'day' });
            $('add-panel').style.display = 'none';
            renderFilters(); renderTable();
        });
    });

    // Filter edit mode
    $('btn-filter-edit').addEventListener('click', () => {
        state.filterEdit = !state.filterEdit;
        $('btn-filter-edit').classList.toggle('active', state.filterEdit);
        renderFilters();
    });

    // Clear all filters
    $('btn-clear-filters').addEventListener('click', () => {
        state.filters = []; state.previewMode = false;
        renderFilters(); renderTable();
    });

    // Reset filters
    $('btn-reset-filters').addEventListener('click', () => {
        state.filters = [
            { filter_type:'name', enabled:false, operator:'contains', value:'', negate:false },
            { filter_type:'extension', enabled:false, value:'', negate:false },
            { filter_type:'size', enabled:false, operator:'>', value:'', unit:'MB', negate:false },
            { filter_type:'date', enabled:false, operator:'recent', value:'', unit:'day', negate:false },
        ];
        state.previewMode = false;
        renderFilters(); renderTable();
    });

    // Rule save
    $('btn-save-rule').addEventListener('click', async () => {
        const name = $('rule-name-input').value.trim();
        if (!name || state.filters.length === 0) return;
        const rule = { id: Date.now().toString(), name, filters: JSON.parse(JSON.stringify(state.filters)), created_at: new Date().toISOString() };
        state.rules.push(rule);
        if (tauriInvoke) await tauriInvoke('save_rules', { rules: state.rules });
        $('rule-name-input').value = '';
        renderRules();
    });

    // Rule edit mode
    $('btn-rule-edit').addEventListener('click', () => {
        state.ruleEdit = !state.ruleEdit;
        $('btn-rule-edit').classList.toggle('active', state.ruleEdit);
        renderRules();
    });

    // Tool toggles (mutual exclusion)
    const toolIds = ['tool-delete-empty','tool-dissolve','tool-dedupe','tool-rotate'];
    toolIds.forEach(id => {
        $(id).addEventListener('change', () => {
            state.deleteEmpty = $('tool-delete-empty').checked;
            state.dissolveMode = $('tool-dissolve').checked;
            state.dedupeMode = $('tool-dedupe').checked;
            state.rotateMode = $('tool-rotate').checked;
            renderFilters();
        });
    });
    $('tool-dissolve-levels').addEventListener('input', () => { state.keepLevels = parseInt($('tool-dissolve-levels').value) || 1; });
    $('tool-rotate-dir').addEventListener('change', () => { state.rotateDir = $('tool-rotate-dir').value; });
    $('tool-rotate-angle').addEventListener('change', () => { state.rotateAngle = parseInt($('tool-rotate-angle').value); });

    // Dialog buttons
    $('dlg-confirm').addEventListener('click', () => closeDlg(true));
    $('dlg-cancel').addEventListener('click', () => closeDlg(false));
    $('dlg-close-x').addEventListener('click', () => closeDlg(false));
    $('dlg-overlay').addEventListener('click', (e) => { if (e.target === $('dlg-overlay')) closeDlg(false); });

    // Preview overlay
    $('preview-overlay').addEventListener('click', (e) => {
        if (e.target === $('preview-overlay')) { $('preview-overlay').style.display = 'none'; }
    });
    $('btn-close-preview').addEventListener('click', () => { $('preview-overlay').style.display = 'none'; });

    // Drag & drop
    const zone = $('import-zone');
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault(); zone.classList.remove('over');
        // In browser mode this won't have Tauri paths, but in Tauri it works via the webview
    });
}

// ── Init ──
async function init() {
    await initTauri();
    bindEvents();
    renderFilters();
    renderRules();
    renderTable();

    // Load rules from Tauri
    if (tauriInvoke) {
        try { state.rules = await tauriInvoke('load_rules'); renderRules(); } catch {}
    }

    // Tauri drag & drop
    try {
        const wv = await import('https://unpkg.com/@tauri-apps/api/webviewWindow');
        const win = wv.getCurrentWebviewWindow();
        win.onDragDropEvent((event) => {
            const type = event.payload.type;
            if (type === 'over') { $('import-zone').classList.add('over'); }
            else if (type === 'leave' || type === 'drop') { $('import-zone').classList.remove('over'); }
            if (type === 'drop' && event.payload.paths?.length > 0 && !state.loading) {
                scanFolder(event.payload.paths[0]);
            }
        });
    } catch {}
}

init();
