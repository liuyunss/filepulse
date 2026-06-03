// HTML 转义工具函数（防 XSS）
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// 全局状态
let currentFiles = [];
let selectedFolder = null;

// 文件扫描
function scanFolder(files) {
    currentFiles = Array.from(files).map(f => ({
        name: f.name,
        size: f.size,
        type: f.name.split('.').pop(),
        lastModified: new Date(f.lastModified),
        path: f.webkitRelativePath
    }));
    renderFileList(currentFiles);
}

// 渲染文件列表
function renderFileList(files) {
    const tbody = document.getElementById('file-tbody');
    tbody.innerHTML = files.map(f => `
        <tr>
            <td><input type="checkbox" class="file-checkbox" data-path="${escapeHtml(f.path)}"></td>
            <td><a href="#" onclick="openFile('${escapeHtml(f.path)}')">${escapeHtml(f.name)}</a></td>
            <td>${formatSize(f.size)}</td>
            <td>${escapeHtml(f.type)}</td>
            <td>${f.lastModified.toLocaleDateString()}</td>
            <td>${escapeHtml(f.path)}</td>
        </tr>
    `).join('');
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
        // 大小筛选
        if (document.getElementById('size-filter').checked) {
            const op = document.getElementById('size-op').value;
            const value = parseFloat(document.getElementById('size-value').value);
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
                    const regex = new RegExp('^' + ext.replace(/\*/g, '.*') + '$');
                    return regex.test(fileExt);
                }
                return fileExt === ext;
            });
            
            if (document.getElementById('ext-negate').checked) match = !match;
            if (!match) return false;
        }
        
        // 日期筛选
        if (document.getElementById('date-filter').checked) {
            const days = parseInt(document.getElementById('date-value').value);
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            let match = f.lastModified >= cutoff;
            
            if (document.getElementById('date-negate').checked) match = !match;
            if (!match) return false;
        }
        
        return true;
    });
}

// 预览（高亮）
function previewFiles() {
    const filtered = filterFiles();
    const rows = document.querySelectorAll('#file-tbody tr');
    rows.forEach(row => {
        const path = row.querySelector('.file-checkbox').dataset.path;
        if (filtered.some(f => f.path === path)) {
            row.style.backgroundColor = '#ffcccc';
        } else {
            row.style.backgroundColor = '';
        }
    });
}

// 删除文件
function deleteFiles() {
    const selected = Array.from(document.querySelectorAll('.file-checkbox:checked'))
        .map(cb => cb.dataset.path);
    
    if (selected.length === 0) {
        alert('请先选择要删除的文件');
        return;
    }
    
    if (confirm(`确定删除以下 ${selected.length} 个文件？\n\n${selected.join('\n')}`)) {
        // 模拟删除
        currentFiles = currentFiles.filter(f => !selected.includes(f.path));
        renderFileList(currentFiles);
        alert('删除成功');
    }
}

// 解散文件夹预览
// 空文件清理
let emptyFiles = [];

function scanEmptyFiles() {
    const exts = document.getElementById('empty-ext-value').value
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(e => e);
    
    if (exts.length === 0) {
        alert('请输入至少一个文件后缀');
        return;
    }
    
    // 筛选空文件（size === 0）
    emptyFiles = currentFiles.filter(f => {
        const ext = '.' + f.type.toLowerCase();
        return f.size === 0 && exts.some(e => e === ext || e === '.' + f.type.toLowerCase());
    });
    
    // 按文件夹分组
    const folderMap = {};
    emptyFiles.forEach(f => {
        const parts = f.path.split('/');
        // 取文件所在文件夹路径（去掉文件名）
        const folderPath = parts.slice(0, -1).join('/') || '(根目录)';
        if (!folderMap[folderPath]) {
            folderMap[folderPath] = [];
        }
        folderMap[folderPath].push(f);
    });
    
    // 渲染预览
    const preview = document.getElementById('empty-cleanup-preview');
    const countDiv = document.getElementById('empty-cleanup-count');
    const listDiv = document.getElementById('empty-cleanup-list');
    
    if (emptyFiles.length === 0) {
        countDiv.textContent = `未找到匹配的空文件`;
        listDiv.innerHTML = '';
        preview.style.display = 'block';
        document.getElementById('btn-delete-empty').disabled = true;
        return;
    }
    
    countDiv.textContent = `找到 ${emptyFiles.length} 个空文件，分布在 ${Object.keys(folderMap).length} 个文件夹中：`;
    
    let html = '';
    Object.keys(folderMap).sort().forEach(folder => {
        const files = folderMap[folder];
        html += `
            <div style="margin: 8px 0; padding: 8px; background: #fff; border: 1px solid #eee; border-radius: 4px;">
                <div style="font-weight: bold; color: #555;">📁 ${escapeHtml(folder)}</div>
                <div style="margin-left: 20px; margin-top: 5px;">
                    ${files.map(f => `
                        <label style="display: block; color: #999;">
                            <input type="checkbox" class="empty-file-checkbox" data-path="${escapeHtml(f.path)}" checked>
                            📄 ${escapeHtml(f.name)} (${escapeHtml(f.type)}, 0KB)
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    });
    
    listDiv.innerHTML = html;
    preview.style.display = 'block';
    document.getElementById('btn-delete-empty').disabled = false;
}

function deleteEmptyFiles() {
    const checked = Array.from(document.querySelectorAll('.empty-file-checkbox:checked'))
        .map(cb => cb.dataset.path);
    
    if (checked.length === 0) {
        alert('请先勾选要删除的文件');
        return;
    }
    
    if (!confirm(`确定删除以下 ${checked.length} 个空文件？\n\n${checked.join('\n')}`)) {
        return;
    }
    
    // 模拟删除
    currentFiles = currentFiles.filter(f => !checked.includes(f.path));
    renderFileList(currentFiles);
    
    // 重新扫描
    scanEmptyFiles();
    
    alert(`已删除 ${checked.length} 个空文件`);
}

// 解散文件夹预览
function previewDissolve() {
    const keepLevels = parseInt(document.getElementById('keep-levels').value);
    const preview = document.getElementById('dissolve-preview');
    
    // 模拟解散预览
    preview.innerHTML = `
        <div style="margin: 10px 0; padding: 10px; background: #f0f0f0;">
            <div><strong>解散预览（保留${keepLevels}级）：</strong></div>
            <div style="margin-top: 10px;">
                <div>原始结构：</div>
                <pre>📁 测试文件夹/
├── 📁 文档/
│   └── 📁 子文件夹/
│       └── 📄 笔记.txt
└── 📁 视频/
    └── 📄 电影.mp4</pre>
            </div>
            <div style="margin-top: 10px;">
                <div>解散后：</div>
                <pre>📁 测试文件夹/
├── 📁 文档/
│   └── 📄 笔记.txt    ← 从子文件夹提到文档
└── 📁 视频/
    └── 📄 电影.mp4</pre>
            </div>
            <div style="margin-top: 10px; color: red;">
                将删除的空文件夹：子文件夹
            </div>
        </div>
    `;
    preview.style.display = 'block';
}

// 规则保存
function getRules() {
    return JSON.parse(localStorage.getItem('filepulse_rules') || '[]');
}

function saveRule(name) {
    const rules = getRules();
    rules.push({
        name,
        conditions: {
            size: document.getElementById('size-filter').checked,
            sizeOp: document.getElementById('size-op').value,
            sizeValue: document.getElementById('size-value').value,
            sizeUnit: document.getElementById('size-unit').value,
            sizeNegate: document.getElementById('size-negate').checked,
            ext: document.getElementById('ext-filter').checked,
            extValue: document.getElementById('ext-value').value,
            extNegate: document.getElementById('ext-negate').checked,
            date: document.getElementById('date-filter').checked,
            dateValue: document.getElementById('date-value').value,
            dateNegate: document.getElementById('date-negate').checked,
        }
    });
    localStorage.setItem('filepulse_rules', JSON.stringify(rules));
    renderRules();
}

function renderRules() {
    const rules = getRules();
    const list = document.getElementById('rules-list');
    list.innerHTML = rules.map((r, i) => `
        <label>
            <input type="checkbox" class="rule-checkbox" data-index="${i}">
            ${escapeHtml(r.name)}
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
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            document.getElementById('current-path').textContent = 
                '当前路径：' + files[0].webkitRelativePath.split('/')[0];
            scanFolder(files);
        }
    });
    
    folderInput.addEventListener('change', e => {
        const files = e.target.files;
        if (files.length > 0) {
            document.getElementById('current-path').textContent = 
                '当前路径：' + files[0].webkitRelativePath.split('/')[0];
            scanFolder(files);
        }
    });
    
    // 按钮事件
    document.getElementById('btn-scan').addEventListener('click', () => {
        if (currentFiles.length === 0) {
            alert('请先选择文件夹');
        } else {
            renderFileList(currentFiles);
        }
    });
    
    document.getElementById('btn-preview').addEventListener('click', previewFiles);
    document.getElementById('btn-delete').addEventListener('click', deleteFiles);
    
    document.getElementById('btn-advanced').addEventListener('click', () => {
        const panel = document.getElementById('advanced-panel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    
    document.getElementById('btn-preview-dissolve').addEventListener('click', previewDissolve);
    
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
        if (confirm(`确定删除规则 "${document.querySelector('.rule-checkbox:checked').parentElement.textContent.trim()}"？`)) {
            const rules = getRules();
            rules.splice(index, 1);
            localStorage.setItem('filepulse_rules', JSON.stringify(rules));
            renderRules();
        }
    });
    
    document.getElementById('btn-execute-dissolve').addEventListener('click', () => {
        alert('执行解散（模拟）');
    });
    
    // 空文件清理
    document.getElementById('btn-empty-cleanup').addEventListener('click', () => {
        const panel = document.getElementById('empty-cleanup-section');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        const advPanel = document.getElementById('advanced-panel');
        advPanel.style.display = 'block';
    });
    
    document.getElementById('btn-close-empty-cleanup').addEventListener('click', () => {
        document.getElementById('empty-cleanup-section').style.display = 'none';
    });
    
    document.getElementById('btn-scan-empty').addEventListener('click', scanEmptyFiles);
    document.getElementById('btn-delete-empty').addEventListener('click', deleteEmptyFiles);
    
    // 全选
    document.getElementById('select-all').addEventListener('change', e => {
        document.querySelectorAll('.file-checkbox').forEach(cb => {
            cb.checked = e.target.checked;
        });
    });
    
    // 筛选条件变化时实时更新
    document.querySelectorAll('#filters input, #filters select').forEach(el => {
        el.addEventListener('change', () => {
            if (currentFiles.length > 0) {
                const filtered = filterFiles();
                renderFileList(filtered);
            }
        });
    });
    
    renderRules();
});
