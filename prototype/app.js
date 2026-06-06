// HTML 转义工具函数（防 XSS）
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 文件扩展名提取（正确处理隐藏文件和无扩展名文件）
function getExtension(filename) {
    const parts = filename.split('.');
    if (parts.length <= 1) return '';             // 无扩展名：Makefile → ''
    if (parts[0] === '' && parts.length === 2) return '';  // 隐藏文件无扩展名：.gitignore → ''
    return parts.pop();                           // .env.local → 'local', file.txt → 'txt'
}

// 全局状态
let currentFiles = [];
let selectedFolder = null;

// 文件扫描
function scanFolder(files) {
    currentFiles = Array.from(files).map(f => ({
        name: f.name,
        size: f.size,
        type: getExtension(f.name),
        lastModified: new Date(f.lastModified),
        path: f.webkitRelativePath
    }));
    renderFileList(currentFiles);
}

// 渲染文件列表（始终渲染全部文件，显示隐藏通过 applyFilters 控制）
function renderFileList(files) {
    const tbody = document.getElementById('file-tbody');
    tbody.innerHTML = files.map(f => `
        <tr data-path="${escapeHtml(f.path)}">
            <td><input type="checkbox" class="file-checkbox" data-path="${escapeHtml(f.path)}"></td>
            <td><a href="#" data-path="${escapeHtml(f.path)}">${escapeHtml(f.name)}</a></td>
            <td>${formatSize(f.size)}</td>
            <td>${escapeHtml(f.type)}</td>
            <td>${f.lastModified.toLocaleDateString()}</td>
            <td>${escapeHtml(f.path)}</td>
        </tr>
    `).join('');
}

// 通过 CSS display 控制行的显示/隐藏（保留复选框状态和滚动位置）
function applyFilters() {
    if (currentFiles.length === 0) return;
    const filtered = filterFiles();
    const filteredPaths = new Set(filtered.map(f => f.path));
    document.querySelectorAll('#file-tbody tr').forEach(row => {
        const path = row.dataset.path;
        row.style.display = filteredPaths.has(path) ? '' : 'none';
    });
}

// 打开文件
function openFile(path) {
    alert('打开文件: ' + path);
}

// 格式化大小
function formatSize(bytes) {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return bytes + ' B';
}

// 筛选文件
function filterFiles() {
    return currentFiles.filter(f => {
        // 名称筛选
        if (document.getElementById('name-filter').checked) {
            const op = document.getElementById('name-op').value;
            const value = document.getElementById('name-value').value.trim().toLowerCase();
            if (!value) return true;
            const name = f.name.toLowerCase();
            let match = false;
            if (op === 'contains') match = name.includes(value);
            if (op === 'prefix') match = name.startsWith(value);
            if (op === 'suffix') match = name.endsWith(value);
            if (document.getElementById('name-negate').checked) match = !match;
            if (!match) return false;
        }
        
        // 大小筛选
        if (document.getElementById('size-filter').checked) {
            const op = document.getElementById('size-op').value;
            const value = parseFloat(document.getElementById('size-value').value);
            if (isNaN(value)) return true; // 无效输入跳过大小筛选
            const unit = document.getElementById('size-unit').value;
            let sizeMB = f.size / 1048576;
            if (unit === 'KB') sizeMB = f.size / 1024;
            if (unit === 'GB') sizeMB = f.size / 1073741824;
            
            let match = false;
            if (op === 'gt') match = sizeMB > value;
            if (op === 'lt') match = sizeMB < value;
            if (op === 'eq') match = Math.abs(sizeMB - value) < 0.001;
            
            if (document.getElementById('size-negate').checked) match = !match;
            if (!match) return false;
        }
        
        // 后缀筛选
        if (document.getElementById('ext-filter').checked) {
            const exts = document.getElementById('ext-value').value.split(',').map(e => e.trim().toLowerCase());
            const fileExt = '.' + f.type.toLowerCase();
            let match = exts.some(ext => {
                if (ext.includes('*')) {
                    return fileExt.includes(ext.replace('*', ''));
                }
                return fileExt === ext;
            });
            if (document.getElementById('ext-negate').checked) match = !match;
            if (!match) return false;
        }
        
        // 日期筛选
        if (document.getElementById('date-filter').checked) {
            const days = parseInt(document.getElementById('date-value').value);
            if (isNaN(days)) return true;
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            let match = f.lastModified >= cutoff;
            if (document.getElementById('date-negate').checked) match = !match;
            if (!match) return false;
        }
        
        // 空文件夹筛选
        if (document.getElementById('empty-filter').checked) {
            const isDir = f.type === '';
            let match = isDir;
            if (document.getElementById('empty-negate').checked) match = !match;
            if (!match) return false;
        }
        
        return true;
    });
}

// 重复文件检测
function findDuplicates(files) {
    // 按文件名+大小分组
    const groups = {};
    files.forEach(f => {
        const key = f.name + '|' + f.size;
        if (!groups[key]) groups[key] = [];
        groups[key].push(f);
    });
    // 只返回有2个以上成员的组，按组内文件总大小降序
    return Object.entries(groups)
        .filter(([, items]) => items.length > 1)
        .sort((a, b) => (b[1][0].size * b[1].length) - (a[1][0].size * a[1].length));
}

function renderDuplicates(groups) {
    const container = document.getElementById('dup-detect-results');
    const summary = document.getElementById('dup-detect-summary');
    if (groups.length === 0) {
        container.innerHTML = '';
        summary.textContent = '未发现重复文件';
        document.getElementById('btn-delete-dup-selected').disabled = true;
        return;
    }
    let totalDupFiles = 0, totalDupSize = 0;
    groups.forEach(([, items]) => {
        totalDupFiles += items.length;
        totalDupSize += items[0].size * (items.length - 1);
    });
    summary.textContent = `发现 ${groups.length} 组重复文件，共 ${totalDupFiles} 个文件，可释放约 ${formatSize(totalDupSize)} 空间`;

    container.innerHTML = groups.map(([key, items], gi) => {
        const name = items[0].name;
        const size = items[0].size;
        const rows = items.map((f, fi) => `
            <div class="dup-file-row">
                <input type="checkbox" class="dup-checkbox" data-group="${gi}" data-index="${fi}" ${fi > 0 ? 'checked' : ''}>
                <div class="dup-file-info">
                    <span class="name">${escapeHtml(f.name)}</span>
                    <span class="path">${escapeHtml(f.path)}</span>
                </div>
                <div class="dup-file-size">${formatSize(f.size)}</div>
            </div>
        `).join('');
        return `
            <div class="dup-group">
                <div class="dup-group-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
                    <span>${escapeHtml(name)} × ${items.length} (${formatSize(size)})</span>
                    <span class="select-all-group">
                        <input type="checkbox" class="dup-group-toggle" data-group="${gi}" checked> 全选反选
                    </span>
                </div>
                <div class="dup-group-body">${rows}</div>
            </div>
        `;
    }).join('');

    // 组全选反选
    container.querySelectorAll('.dup-group-toggle').forEach(toggle => {
        toggle.addEventListener('change', e => {
            const gi = e.target.dataset.group;
            container.querySelectorAll(`.dup-checkbox[data-group="${gi}"]`).forEach(cb => cb.checked = e.target.checked);
        });
    });

    // checkbox变化时更新按钮状态
    container.querySelectorAll('.dup-checkbox').forEach(cb => {
        cb.addEventListener('change', updateDupDeleteBtn);
    });
    updateDupDeleteBtn();
}

function updateDupDeleteBtn() {
    const anyChecked = document.querySelectorAll('.dup-checkbox:checked').length > 0;
    document.getElementById('btn-delete-dup-selected').disabled = !anyChecked;
}

function deleteDupSelected() {
    const checked = document.querySelectorAll('.dup-checkbox:checked');
    if (checked.length === 0) return;
    const paths = Array.from(checked).map(cb => {
        const gi = parseInt(cb.dataset.group);
        const fi = parseInt(cb.dataset.index);
        return dupGroups[gi][1][fi].path;
    });
    alert('将删除以下 ' + paths.length + ' 个重复文件：\n' + paths.join('\n'));
}

// 全局缓存检测结果
let dupGroups = [];

// 空文件扫描
function scanEmptyFiles() {
    if (currentFiles.length === 0) { alert('请先扫描文件夹'); return; }
    
    const exts = document.getElementById('empty-ext-value').value
        .split(',').map(e => e.trim().toLowerCase());
    
    const emptyFiles = currentFiles.filter(f => f.size === 0 && exts.some(ext => 
        ext.includes('*') ? f.type.toLowerCase().includes(ext.replace('*', '')) : ('.' + f.type.toLowerCase()) === ext
    ));
    
    const preview = document.getElementById('empty-cleanup-preview');
    const list = document.getElementById('empty-cleanup-list');
    const count = document.getElementById('empty-cleanup-count');
    
    if (emptyFiles.length === 0) {
        preview.style.display = 'block';
        count.textContent = '未找到符合条件的空文件';
        list.innerHTML = '';
        document.getElementById('btn-delete-empty').disabled = true;
        return;
    }
    
    preview.style.display = 'block';
    count.textContent = `找到 ${emptyFiles.length} 个空文件`;
    list.innerHTML = emptyFiles.map(f => `
        <div class="dup-file-row">
            <input type="checkbox" class="empty-checkbox" data-path="${escapeHtml(f.path)}">
            <div class="dup-file-info">
                <span class="name">${escapeHtml(f.name)}</span>
                <span class="path">${escapeHtml(f.path)}</span>
            </div>
        </div>
    `).join('');
    
    // 全选
    list.querySelectorAll('.empty-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            const any = list.querySelectorAll('.empty-checkbox:checked').length > 0;
            document.getElementById('btn-delete-empty').disabled = !any;
        });
    });
    
    document.getElementById('btn-delete-empty').disabled = false;
}

function deleteEmptyFiles() {
    const checked = document.querySelectorAll('.empty-checkbox:checked');
    if (checked.length === 0) return;
    const paths = Array.from(checked).map(cb => cb.dataset.path);
    alert('将删除以下 ' + paths.length + ' 个空文件：\n' + paths.join('\n'));
}

// 解散文件夹预览
function previewDissolve() {
    const keepLevels = parseInt(document.getElementById('keep-levels').value);
    const preview = document.getElementById('dissolve-preview');
    
    if (currentFiles.length === 0) {
        preview.style.display = 'block';
        preview.innerHTML = '请先扫描文件夹';
        return;
    }
    
    // 统计目录结构
    const dirs = {};
    currentFiles.forEach(f => {
        const parts = f.path.split('/');
        if (parts.length > 1) {
            const dir = parts.slice(0, -1).join('/');
            dirs[dir] = (dirs[dir] || 0) + 1;
        }
    });
    
    const dirCount = Object.keys(dirs).length;
    preview.style.display = 'block';
    preview.innerHTML = `
        <div style="margin-bottom: 10px;">
            <strong>解散预览</strong>（保留 ${keepLevels} 级）
        </div>
        <div>共 ${dirCount} 个目录，${currentFiles.length} 个文件</div>
        <div style="margin-top: 10px; color: #666;">
            提示：实际解散功能需要后端支持
        </div>
    `;
}

// 规则管理
function getRules() {
    try {
        return JSON.parse(localStorage.getItem('filepulse_rules') || '[]');
    } catch {
        return [];
    }
}

function saveRule(name) {
    const rule = {
        name,
        size: document.getElementById('size-filter').checked ? {
            op: document.getElementById('size-op').value,
            value: document.getElementById('size-value').value,
            unit: document.getElementById('size-unit').value,
            negate: document.getElementById('size-negate').checked
        } : null,
        ext: document.getElementById('ext-filter').checked ? {
            value: document.getElementById('ext-value').value,
            negate: document.getElementById('ext-negate').checked
        } : null,
        date: document.getElementById('date-filter').checked ? {
            value: document.getElementById('date-value').value,
            negate: document.getElementById('date-negate').checked
        } : null
    };
    
    const rules = getRules();
    rules.push(rule);
    localStorage.setItem('filepulse_rules', JSON.stringify(rules));
    renderRules();
}

function renderRules() {
    const list = document.getElementById('rules-list');
    const rules = getRules();
    
    if (rules.length === 0) {
        list.innerHTML = '<div style="color: #999;">暂无规则</div>';
        return;
    }
    
    list.innerHTML = rules.map((rule, i) => `
        <label>
            <input type="radio" class="rule-checkbox" name="rule" value="${i}">
            ${escapeHtml(rule.name)}
        </label>
    `).join('');
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 文件夹选择
    const dropZone = document.getElementById('drop-zone');
    const folderInput = document.getElementById('folder-input');
    
    dropZone.addEventListener('click', () => folderInput.click());
    
    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.style.borderColor = '#007bff';
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '#ccc';
    });
    
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.style.borderColor = '#ccc';
        const items = e.dataTransfer.items;
        if (items.length > 0) {
            const entry = items[0].webkitGetAsEntry();
            if (entry && entry.isDirectory) {
                selectedFolder = entry;
                document.getElementById('current-path').textContent = '当前路径：' + entry.name;
            }
        }
    });
    
    folderInput.addEventListener('change', e => {
        const files = e.target.files;
        if (files.length > 0) {
            scanFolder(files);
            document.getElementById('current-path').textContent = '当前路径：' + files[0].webkitRelativePath.split('/')[0];
        }
    });
    
    // 按钮事件
    document.getElementById('btn-scan').addEventListener('click', () => {
        if (currentFiles.length > 0) {
            applyFilters();
        }
    });
    
    document.getElementById('btn-preview').addEventListener('click', () => {
        const checked = document.querySelectorAll('.file-checkbox:checked');
        if (checked.length === 0) {
            alert('请先选择文件');
            return;
        }
        alert('预览 ' + checked.length + ' 个文件');
    });
    
    document.getElementById('btn-delete').addEventListener('click', () => {
        const checked = document.querySelectorAll('.file-checkbox:checked');
        if (checked.length === 0) {
            alert('请先选择文件');
            return;
        }
        if (confirm('确定删除选中的 ' + checked.length + ' 个文件？')) {
            alert('删除（模拟）');
        }
    });
    
    // 高级面板
    document.getElementById('btn-advanced').addEventListener('click', () => {
        const panel = document.getElementById('advanced-panel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    
    // 重复文件检测
    document.getElementById('btn-scan-dup').addEventListener('click', () => {
        if (currentFiles.length === 0) { alert('请先扫描文件夹'); return; }
        dupGroups = findDuplicates(currentFiles);
        renderDuplicates(dupGroups);
    });
    
    document.getElementById('btn-delete-dup-selected').addEventListener('click', deleteDupSelected);
    
    document.getElementById('btn-close-dup').addEventListener('click', () => {
        document.getElementById('dup-detect-section').style.display = 'none';
    });
    
    document.getElementById('btn-dup-detect').addEventListener('click', () => {
        const panel = document.getElementById('dup-detect-section');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    
    // 空文件清理
    document.getElementById('btn-empty-cleanup').addEventListener('click', () => {
        const panel = document.getElementById('empty-cleanup-section');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    
    document.getElementById('btn-scan-empty').addEventListener('click', scanEmptyFiles);
    document.getElementById('btn-delete-empty').addEventListener('click', deleteEmptyFiles);
    document.getElementById('btn-close-empty-cleanup').addEventListener('click', () => {
        document.getElementById('empty-cleanup-section').style.display = 'none';
    });
    
    // 解散文件夹
    document.getElementById('btn-preview-dissolve').addEventListener('click', previewDissolve);
    document.getElementById('btn-execute-dissolve').addEventListener('click', () => {
        alert('执行解散（模拟）');
    });
    
    // 规则管理
    document.getElementById('btn-save-rule').addEventListener('click', () => {
        const name = prompt('请输入规则名称：');
        if (name) saveRule(name);
    });
    
    document.getElementById('btn-execute-rule').addEventListener('click', () => {
        const checked = document.querySelector('.rule-checkbox:checked');
        if (!checked) {
            alert('请先选择一个规则');
            return;
        }
        alert('执行规则：' + checked.parentElement.textContent.trim());
    });
    
    document.getElementById('btn-delete-rule').addEventListener('click', () => {
        const checked = document.querySelector('.rule-checkbox:checked');
        if (!checked) {
            alert('请先选择一个规则');
            return;
        }
        const index = parseInt(checked.dataset.index);
        if (isNaN(index)) return;
        if (confirm(`确定删除规则 "${document.querySelector('.rule-checkbox:checked').parentElement.textContent.trim()}"？`)) {
            const rules = getRules();
            rules.splice(index, 1);
            localStorage.setItem('filepulse_rules', JSON.stringify(rules));
            renderRules();
        }
    });
    
    // 全选（仅选中可见行，排除被筛选隐藏的行）
    document.getElementById('select-all').addEventListener('change', e => {
        document.querySelectorAll('.file-checkbox').forEach(cb => {
            const row = cb.closest('tr');
            if (row && row.style.display !== 'none') {
                cb.checked = e.target.checked;
            }
        });
    });
    
    // 文件链接点击（事件委托，替代行内 onclick）
    document.getElementById('file-tbody').addEventListener('click', e => {
        const link = e.target.closest('a[data-path]');
        if (link) {
            e.preventDefault();
            openFile(link.dataset.path);
        }
    });
    
    // 筛选条件变化时实时更新（使用 CSS display 控制，保留状态和滚动位置）
    document.querySelectorAll('#filters input, #filters select').forEach(el => {
        el.addEventListener('change', () => {
            if (currentFiles.length > 0) {
                applyFilters();
            }
        });
    });
    
    renderRules();
    
    // 初始化线程数（自动检测CPU核数）
    const cores = navigator.hardwareConcurrency || 4;
    document.getElementById('thread-count').value = cores;
    document.getElementById('thread-hint').textContent = `检测到 ${navigator.hardwareConcurrency ? cores + ' 核CPU' : '默认值'}`;
});
