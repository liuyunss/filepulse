const $ = (id) => document.getElementById(id);
function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function fmtSize(b) { if(b>=1073741824)return(b/1073741824).toFixed(2)+' GB'; if(b>=1048576)return(b/1048576).toFixed(2)+' MB'; if(b>=1024)return(b/1024).toFixed(2)+' KB'; return b+' B'; }
function ext(n) { const p = n.split('.'); return p.length<=1||(p[0]===''&&p.length===2)?'':p.pop(); }

// ── 模拟数据 ──
const mockData = [
    { name:'项目文档.docx', path:'Docs/项目文档.docx', size:2457600, extension:'docx', modified:new Date('2026-06-05T10:30:00') },
    { name:'年度总结.pptx', path:'Docs/年度总结.pptx', size:15728640, extension:'pptx', modified:new Date('2026-05-20T14:00:00') },
    { name:'logo.png', path:'Assets/logo.png', size:204800, extension:'png', modified:new Date('2026-06-01T09:00:00') },
    { name:'background.jpg', path:'Assets/background.jpg', size:5242880, extension:'jpg', modified:new Date('2026-04-15T16:30:00') },
    { name:'config.json', path:'Config/config.json', size:4096, extension:'json', modified:new Date('2026-06-06T08:00:00') },
    { name:'database.sqlite', path:'Data/database.sqlite', size:104857600, extension:'sqlite', modified:new Date('2026-06-03T22:00:00') },
    { name:'debug.log', path:'Logs/debug.log', size:0, extension:'log', modified:new Date('2026-05-01T00:00:00') },
    { name:'error.log', path:'Logs/error.log', size:0, extension:'log', modified:new Date('2026-04-28T12:00:00') },
    { name:'setup.exe', path:'Build/setup.exe', size:52428800, extension:'exe', modified:new Date('2026-03-10T18:00:00') },
    { name:'README.md', path:'Docs/README.md', size:8192, extension:'md', modified:new Date('2026-06-05T23:00:00') },
    { name:'style.css', path:'Web/style.css', size:16384, extension:'css', modified:new Date('2026-05-30T11:00:00') },
    { name:'index.html', path:'Web/index.html', size:32768, extension:'html', modified:new Date('2026-06-04T20:00:00') },
];

let allFiles = [...mockData], sortKey = 'path', sortAsc = true, previewMode = false;

function readConfig() { return {
    name:$('name-filter').checked,nameOp:$('name-op').value,nameValue:$('name-value').value,nameNegate:$('name-negate').checked,
    size:$('size-filter').checked,sizeOp:$('size-op').value,sizeValue:$('size-value').value,sizeUnit:$('size-unit').value,sizeNegate:$('size-negate').checked,
    ext:$('ext-filter').checked,extValue:$('ext-value').value,extNegate:$('ext-negate').checked,
    date:$('date-filter').checked,dateOp:$('date-op').value,dateValue:$('date-value').value,dateUnit:$('date-unit').value,dateNegate:$('date-negate').checked,
    empty:$('empty-filter').checked,emptyNegate:$('empty-negate').checked,
};}
function applyConfig(c) {
    for(let k of ['name','size','ext','date','empty']){$(`${k}-filter`).checked=c[k];}
    $('name-op').value=c.nameOp;$('name-value').value=c.nameValue;$('name-negate').checked=c.nameNegate;
    $('size-op').value=c.sizeOp;$('size-value').value=c.sizeValue;$('size-unit').value=c.sizeUnit;$('size-negate').checked=c.sizeNegate;
    $('ext-value').value=c.extValue;$('ext-negate').checked=c.extNegate;
    $('date-op').value=c.dateOp;$('date-value').value=c.dateValue;$('date-unit').value=c.dateUnit;$('date-negate').checked=c.dateNegate;
    $('empty-negate').checked=c.emptyNegate;
    // 加载规则后自动进入预览模式
    previewMode = true;
    $('btn-preview').style.background = 'var(--blue-bg)';
    $('status-text').textContent = '预览模式 — 已加载规则';
    updateSortBtns(); renderTable();
}
function loadFiles(files, folder) {
    allFiles = Array.from(files).filter(f=>f.name).map(f=>({name:f.name,path:f.webkitRelativePath||(folder?folder+'/'+f.name:f.name),size:f.size,extension:ext(f.name),modified:new Date(f.lastModified)}));
    $('file-count').textContent=allFiles.length+' 个文件'; updateSortBtns(); renderTable();
}
function sorted(list) {
    return [...list].sort((a,b)=>{let va=sortKey==='size'?a.size:sortKey==='modified'?a.modified.getTime():(a[sortKey]??'');let vb=sortKey==='size'?b.size:sortKey==='modified'?b.modified.getTime():(b[sortKey]??'');return(va<vb?-1:va>vb?1:0)*(sortAsc?1:-1);});
}
function filtered() { return allFiles.filter(f=>{
    if($('name-filter').checked){const v=$('name-value').value.toLowerCase().trim();if(v){let m=$('name-op').value==='prefix'?f.name.toLowerCase().startsWith(v):$('name-op').value==='suffix'?f.name.toLowerCase().endsWith('.'+v):f.name.toLowerCase().includes(v);if($('name-negate').checked)m=!m;if(!m)return false;}}
    if($('size-filter').checked){const v=parseFloat($('size-value').value);if(!isNaN(v)){const u=$('size-unit').value;let s=f.size/(u==='KB'?1024:u==='GB'?1073741824:1048576);let m=$('size-op').value==='gt'?s>v:$('size-op').value==='lt'?s<v:Math.abs(s-v)<=0.001;if($('size-negate').checked)m=!m;if(!m)return false;}}
    if($('ext-filter').checked){const es=$('ext-value').value.split(',').map(e=>e.trim().toLowerCase()).filter(e=>e);let m=es.includes('.'+(f.extension||'').toLowerCase());if($('ext-negate').checked)m=!m;if(!m)return false;}
    if($('date-filter').checked){const d=parseInt($('date-value').value);if(!isNaN(d)){const c=new Date(),u=$('date-unit').value;if(u==='hour')c.setHours(c.getHours()-d);else if(u==='month')c.setMonth(c.getMonth()-d);else c.setDate(c.getDate()-d);let m=$('date-op').value==='lt'?f.modified>=c:f.modified<c;if($('date-negate').checked)m=!m;if(!m)return false;}}
    if($('empty-filter').checked){const dir=f.path.split('/').slice(0,-1).join('/'),sibs=allFiles.filter(s=>s.path.split('/').slice(0,-1).join('/')===dir);let m=sibs.every(s=>s.size===0);if($('empty-negate').checked)m=!m;if(!m)return false;}
    return true;
});}

function updateAll() { $('file-count').textContent=allFiles.length+' 个文件'; updateSortBtns(); renderTable(); }
function renderTable() {
    const list = previewMode ? filtered() : allFiles;
    const display = sorted(list);
    const tb = $('file-tbody');
    tb.innerHTML = display.map(f=>`<tr data-path="${esc(f.path)}"><td class="col-chk"><input type="checkbox" class="chk" data-path="${esc(f.path)}"></td><td title="${esc(f.path)}">${esc(f.path)}</td><td>${fmtSize(f.size)}</td><td>${esc(f.extension||'-')}</td><td>${f.modified.toLocaleDateString('zh-CN')} ${f.modified.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</td><td class="col-action"><button class="loc-btn" data-path="${esc(f.path)}" title="打开文件位置">📂</button></td></tr>`).join('');
    // bind open location
    document.querySelectorAll('.loc-btn').forEach(btn=>{btn.onclick=(e)=>{e.stopPropagation();openLocation(btn.dataset.path);};});
    // update select-all state
    updateSelectAll();
}
function updateSelectAll() {
    const allChk = document.querySelectorAll('#file-tbody .chk');
    const checked = document.querySelectorAll('#file-tbody .chk:checked');
    $('select-all').checked = allChk.length > 0 && checked.length === allChk.length;
    $('select-all').indeterminate = checked.length > 0 && checked.length < allChk.length;
}
function updateSortBtns() {
    document.querySelectorAll('.sort-btn').forEach(btn=>{btn.classList.toggle('active',btn.dataset.sort===sortKey);btn.textContent=btn.dataset.sort===sortKey?(sortAsc?'▲':'▼'):'▲';});
}
function doSort(key) { if(sortKey===key)sortAsc=!sortAsc;else{sortKey=key;sortAsc=true;} updateSortBtns(); renderTable(); }

// ── 预览匹配：开关筛选显示 ──
function togglePreview() {
    previewMode = !previewMode;
    if (previewMode) {
        $('btn-preview').style.background = 'var(--blue-bg)';
        $('status-text').textContent = '预览模式 — 筛选匹配中';
    } else {
        $('btn-preview').style.background = '';
        $('status-text').textContent = '就绪';
    }
    renderTable();
}

// ── 删除选中（直接作用于表格勾选） ──
function deleteSelected() {
    const paths = Array.from(document.querySelectorAll('#file-tbody .chk:checked')).map(c => c.dataset.path);
    if (!paths.length) { alert('请先勾选文件'); return; }
    if (!confirm('删除 ' + paths.length + ' 个文件？')) return;
    allFiles = allFiles.filter(f => !paths.includes(f.path));
    updateAll();
    $('status-text').textContent = '已删除 ' + paths.length + ' 个文件';
}

// ── 打开文件位置 ──
function openLocation(path) {
    alert('打开文件位置: ' + path + '\n\n(浏览器中为模拟，exe中用原生API打开)');
}

// ── 规则 ──
function getRules() { try{return JSON.parse(localStorage.getItem('fp_rules')||'[]');}catch{return[];} }
function saveRule(name) { const rules = getRules(); rules.push({name,config:readConfig()}); localStorage.setItem('fp_rules',JSON.stringify(rules)); renderRules(); }
function deleteRule(i) { const rules = getRules(); rules.splice(i,1); localStorage.setItem('fp_rules',JSON.stringify(rules)); renderRules(); }
function renderRules() {
    $('rules-list').innerHTML = getRules().map((r,i)=>{
        const cfg = r.config;
        const parts = [];
        if(cfg.name) parts.push('名称:'+(cfg.nameOp==='prefix'?'前缀':'包含')+' '+cfg.nameValue);
        if(cfg.size) parts.push('大小'+(cfg.sizeOp==='gt'?'>':'<')+cfg.sizeValue+cfg.sizeUnit);
        if(cfg.ext) parts.push('后缀:'+cfg.extValue);
        if(cfg.date) parts.push('日期:'+(cfg.dateOp==='lt'?'最近':'早于')+cfg.dateValue+cfg.dateUnit);
        if(cfg.empty) parts.push('空文件夹');
        const summary = parts.length ? parts.join(' | ') : '无筛选条件';
        return `<div class="rule-item"><span class="rule-name" title="${esc(summary)}">${esc(r.name)}<span style="color:#999;font-size:10px"> — ${esc(summary)}</span></span><button data-idx="${i}" class="rule-load" style="font-size:10px;padding:1px 5px">加载</button><span class="rule-del" data-idx="${i}">✕</span></div>`;
    }).join('');
    document.querySelectorAll('.rule-load').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();applyConfig(getRules()[parseInt(b.dataset.idx)].config);}));
    document.querySelectorAll('.rule-del').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();deleteRule(parseInt(b.dataset.idx));}));
}

// ── 初始化 ──
document.addEventListener('DOMContentLoaded', () => {
    updateAll();
    const dz = $('drop-zone'), fi = $('folder-input');
    $('btn-browse').addEventListener('click', e => { e.stopPropagation(); fi.value = ''; fi.click(); });
    dz.addEventListener('click', () => { fi.value = ''; fi.click(); });
    fi.addEventListener('change', e => { const f = e.target.files; if (f?.length) loadFiles(f, f[0].webkitRelativePath.split('/')[0]); });

    let dc = 0;
    document.addEventListener('dragenter', e => { e.preventDefault(); dc++; dz.classList.add('drag-over'); document.body.classList.add('drag-over'); });
    document.addEventListener('dragleave', e => { e.preventDefault(); dc--; if (dc <= 0) { dc = 0; dz.classList.remove('drag-over'); document.body.classList.remove('drag-over'); } });
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => { e.preventDefault(); dc = 0; dz.classList.remove('drag-over'); document.body.classList.remove('drag-over'); const f = e.dataTransfer.files; if (f?.length) loadFiles(f, f[0].webkitRelativePath?.split('/')[0] || ''); });

    document.querySelectorAll('.sort-btn').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); doSort(b.dataset.sort); }));
    // 筛选条件变化：保持在预览模式时实时更新，普通模式只更新表头
    document.querySelectorAll('#filters input, #filters select').forEach(el => {
        const handler = () => {
            if (previewMode) renderTable();
            updateSortBtns();
        };
        el.addEventListener('change', handler);
        if (el.type === 'text' || el.type === 'number') el.addEventListener('input', handler);
    });

    $('btn-preview').addEventListener('click', togglePreview);
    $('btn-delete').addEventListener('click', deleteSelected);

    $('select-all').addEventListener('change', e => {
        document.querySelectorAll('#file-tbody .chk').forEach(c => { c.checked = e.target.checked; });
    });
    $('file-tbody').addEventListener('click', e => {
        if (e.target.classList.contains('loc-btn')) return;
        const row = e.target.closest('tr'), cb = row?.querySelector('.chk');
        if (cb && e.target !== cb) { cb.checked = !cb.checked; updateSelectAll(); }
    });
    document.addEventListener('change', e => { if (e.target.classList.contains('chk')) updateSelectAll(); });

    $('btn-save-rule').addEventListener('click', () => { const n = $('rule-name').value.trim(); if (!n) { alert('请输入名称'); return; } saveRule(n); $('rule-name').value = ''; });
    $('btn-dissolve').addEventListener('click', () => alert('解散预览（保留' + $('keep-levels').value + '级）\n\n(浏览器中为模拟)'));
    renderRules();
});
