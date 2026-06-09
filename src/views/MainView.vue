<template>
  <div class="main-view">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="tb-group">
        <button class="tb-btn" title="导入文件夹" @click="selectFolder">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            <line x1="12" y1="11" x2="12" y2="17"/><polyline points="9 14 12 17 15 14"/>
          </svg>
        </button>
        <button class="tb-btn" :class="{ active: store.previewMode }" title="预览匹配" @click="store.previewMode = !store.previewMode">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
        <button class="tb-btn" :disabled="store.selectedCount === 0" title="取消选中" @click="removeSelected">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </button>
        <button class="tb-btn tb-btn--danger" :disabled="store.selectedCount === 0" title="删除文件" @click="handleDelete">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
          </svg>
          <em v-if="store.selectedCount > 0">{{ store.selectedCount }}</em>
        </button>
      </div>
    </div>

    <!-- 内容区 -->
    <div class="content">
      <!-- 空状态：导入区域 -->
      <div v-if="store.files.length === 0 && !store.loading" class="empty-state">
        <div class="import-zone" :class="{ over: dragging }" @click="selectFolder">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            <line x1="12" y1="11" x2="12" y2="17"/><polyline points="9 14 12 17 15 14"/>
          </svg>
          <p>选择文件夹或拖拽到此处导入</p>
        </div>
      </div>

      <!-- 文件表格 -->
      <template v-else>
        <div class="table-scroll">
          <table class="file-table">
            <thead>
              <tr>
                <th class="col-check"><input type="checkbox" :checked="allSelected" @change="store.selectAll" /></th>
                <th class="col-path sortable" @click="store.setSort('name')">路径 {{ sortIcon('name') }}</th>
                <th class="col-size sortable" @click="store.setSort('size')">大小 {{ sortIcon('size') }}</th>
                <th class="col-type sortable" @click="store.setSort('extension')">类型 {{ sortIcon('extension') }}</th>
                <th class="col-date sortable" @click="store.setSort('modified')">修改时间 {{ sortIcon('modified') }}</th>
                <th class="col-action">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="file in store.filteredFiles" :key="file.path" :class="{ selected: store.selectedPaths.has(file.path) }" @click="store.toggleSelect(file.path)">
                <td class="col-check" :style="{ borderLeftColor: fileColor(file) }" @click.stop><input type="checkbox" :checked="store.selectedPaths.has(file.path)" @change="store.toggleSelect(file.path)" /></td>
                <td class="col-path"><span class="path-text" :title="file.name">{{ file.name }}</span></td>
                <td class="col-size">{{ file.is_dir ? '-' : formatSize(file.size) }}</td>
                <td class="col-type"><span class="type-tag" :style="{ background: fileColor(file), color:'#fff' }">{{ file.is_dir ? '文件夹' : file.extension.toUpperCase() || '-' }}</span></td>
                <td class="col-date" :title="file.modified">{{ file.modified }}</td>
                <td class="col-action">
                  <button v-if="isPreviewable(file)" class="row-btn" @click.stop="openPreview(file)" title="预览">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                  </button>
                  <button class="row-btn" @click.stop="openInExplorer(file.path)" title="打开位置">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- 预览模态框 -->
      <div v-if="previewItem" class="preview-overlay" @click="previewItem = null">
        <div class="preview-box" @click.stop>
          <button class="preview-close" @click="previewItem = null">✕</button>
          <img v-if="previewType === 'image'" :src="previewUrl" class="preview-img" />
          <video v-else-if="previewType === 'video'" :src="previewUrl" controls autoplay class="preview-video" />
        </div>
      </div>

      <!-- 加载中 -->
      <div v-if="store.loading" class="loading-overlay">
        <div class="loading-spinner" />
        <span>扫描中...</span>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="statusbar">
      <span class="status-path" :title="store.currentPath">{{ store.currentPath || '未选择文件夹' }}</span>
      <div class="status-stats">
        <span class="stat">选中 <strong>{{ store.selectedCount }}</strong></span>
        <span class="stat">筛选 <strong>{{ store.previewMode ? store.matchedCount : store.totalCount }}</strong></span>
        <span class="stat">总数 <strong>{{ store.totalCount }}</strong></span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { open, confirm } from '@tauri-apps/plugin-dialog'
import { useFilePulseStore } from '@/stores/filepulse'

const store = useFilePulseStore()
const dragging = ref(false)
const previewItem = ref<any>(null)
const previewType = ref('')
const previewUrl = ref('')

const typeColors: Record<string, string> = {
  image: '#52c41a', video: '#ff4d4f', audio: '#722ed1',
  doc: '#1890ff', archive: '#fa8c16', code: '#0ea5e9',
  exe: '#8c8c8c', folder: '#d9d9d9',
}

function fileColor(file: any): string {
  if (file.is_dir) return typeColors.folder
  const ext = file.extension.toLowerCase()
  const m: Record<string, string> = {
    jpg:'image',jpeg:'image',png:'image',gif:'image',bmp:'image',svg:'image',webp:'image',ico:'image',
    mp4:'video',avi:'video',mkv:'video',mov:'video',wmv:'video',flv:'video',webm:'video',
    mp3:'audio',wav:'audio',flac:'audio',aac:'audio',ogg:'audio',wma:'audio',m4a:'audio',
    pdf:'doc',doc:'doc',docx:'doc',xls:'doc',xlsx:'doc',ppt:'doc',pptx:'doc',txt:'doc',md:'doc',
    zip:'archive',rar:'archive','7z':'archive',tar:'archive',gz:'archive',bz2:'archive',
    js:'code',ts:'code',py:'code',java:'code',cpp:'code',rs:'code',go:'code',vue:'code',html:'code',css:'code',
    exe:'exe',msi:'exe',bat:'exe',sh:'exe',apk:'exe',app:'exe',
  }
  return typeColors[m[ext]] || '#d9d9d9'
}

function isPreviewable(file: any): boolean {
  const ext = file.extension.toLowerCase()
  const img = ['jpg','jpeg','png','gif','bmp','svg','webp','ico']
  const vid = ['mp4','avi','mkv','mov','webm']
  return img.includes(ext) || vid.includes(ext)
}

async function openPreview(file: any) {
  previewItem.value = file
  const ext = file.extension.toLowerCase()
  const img = ['jpg','jpeg','png','gif','bmp','svg','webp','ico']
  try {
    const { convertFileSrc } = await import('@tauri-apps/api/core')
    const url = convertFileSrc(file.path)
    previewUrl.value = url
    previewType.value = img.includes(ext) ? 'image' : 'video'
  } catch {
    previewUrl.value = `file://${file.path}`
    previewType.value = img.includes(ext) ? 'image' : 'video'
  }
}

const allSelected = computed(() => {
  const all = store.filteredFiles.map(f => f.path)
  return all.length > 0 && all.every(p => store.selectedPaths.has(p))
})

function sortIcon(key: string) {
  if (store.sortKey !== key) return ''
  return store.sortAsc ? '↑' : '↓'
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i]
}

async function openInExplorer(path: string) {
  try {
    const { open: shellOpen } = await import('@tauri-apps/plugin-shell')
    await shellOpen(path)
  } catch (e) {}
}

onMounted(async () => {
  try {
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    getCurrentWebviewWindow().onDragDropEvent((event: any) => {
      if (event.payload.type === 'drop' && event.payload.paths.length > 0) {
        store.scanFiles(event.payload.paths[0])
      }
      dragging.value = event.payload.type === 'over'
    })
  } catch (e) {
    console.warn('Drag-drop not available:', e)
  }
})

async function selectFolder() {
  const selected = await open({ directory: true, multiple: false })
  if (selected) store.scanFiles(selected)
}

function removeSelected() {
  store.selectedPaths = new Set()
}

async function handleDelete() {
  const ok = await confirm('确认删除选中的文件？此操作不可恢复。', { title: '删除确认', kind: 'warning' })
  if (ok) await store.deleteSelected()
}
</script>

<style scoped>
.main-view { display:flex; flex-direction:column; height:100%; overflow:hidden; }

/* 工具栏 */
.toolbar { display:flex; align-items:center; padding:8px 14px; border-bottom:1px solid var(--border-color); background:var(--bg-secondary); }
.tb-group { display:flex; align-items:center; gap:4px; }
.tb-btn {
  display:flex; align-items:center; justify-content:center; gap:2px;
  width:38px; height:34px; border:1px solid transparent; border-radius:6px;
  background:transparent; color:var(--text-secondary); cursor:pointer; transition:all .15s; position:relative;
}
.tb-btn:hover:not(:disabled) { background:var(--bg-hover); color:var(--text-primary); }
.tb-btn.active { background:#e6f7ff; color:var(--accent-color); }
.tb-btn--danger:hover:not(:disabled) { background:#fff1f0; color:var(--danger-color); }
.tb-btn:disabled { opacity:.3; cursor:not-allowed; }
.tb-btn em {
  position:absolute; top:-2px; right:-2px; font-style:normal; font-size:10px;
  background:var(--danger-color); color:#fff; border-radius:8px; padding:0 5px; line-height:15px; min-width:16px; text-align:center;
}

/* 内容区 */
.content { flex:1; overflow:hidden; display:flex; flex-direction:column; position:relative; }

/* 空状态导入区 */
.empty-state { flex:1; display:flex; align-items:center; justify-content:center; }
.import-zone {
  display:flex; flex-direction:column; align-items:center; gap:16px;
  padding:48px 64px; border:2px dashed #d9d9d9; border-radius:12px;
  cursor:pointer; color:#bbb; transition:all .2s;
}
.import-zone:hover { border-color:var(--accent-color); color:var(--accent-color); background:#fafcff; }
.import-zone.over { border-color:var(--accent-color); color:var(--accent-color); background:#e6f7ff; }
.import-zone p { font-size:14px; }

/* 表格 */
.table-scroll { flex:1; overflow:hidden auto; }

.file-table { width:96%; margin:0 2%; border-collapse:separate; border-spacing:0 3px; font-size:13px; table-layout:fixed; }
.file-table thead { position:sticky; top:0; z-index:2; }
.file-table th {
  position:sticky; top:0; background:#eef2fb; padding:7px 10px;
  text-align:left; font-weight:600; font-size:12px; color:#5a6a85;
  border-bottom:1px solid #d0d9f0; white-space:nowrap; user-select:none;
  box-sizing:border-box;
}
.file-table th:first-child { box-shadow:-2.1vw 0 0 #eef2fb; }
.file-table th:last-child { box-shadow:2.1vw 0 0 #eef2fb; }
.file-table th.sortable { cursor:pointer; }
.file-table th.sortable:hover { color:var(--accent-color); }
.file-table td {
  padding:6px 10px; background:#fff; border-top:1px solid #eef0f5; border-bottom:1px solid #eef0f5;
  box-sizing:border-box;
}
.file-table td:first-child { border-left:1px solid #eef0f5; border-radius:4px 0 0 4px; }
.file-table td:last-child { border-right:1px solid #eef0f5; border-radius:0 4px 4px 0; background:#fff; }
.file-table tr.selected td:last-child { background:#e6f7ff; }
.file-table td.col-check { border-left:3px solid #d9d9d9; }
.file-table tr.selected td { background:#e6f7ff; border-color:#bae0ff; }

.type-tag { font-size:11px; padding:2px 6px; border-radius:3px; font-weight:500; }
.col-action { display:flex; gap:2px; justify-content:center; }

/* 预览 */
.preview-overlay { position:fixed; inset:0; background:rgba(0,0,0,.7); z-index:100; display:flex; align-items:center; justify-content:center; cursor:pointer; }
.preview-box { max-width:90vw; max-height:90vh; position:relative; cursor:default; }
.preview-close { position:absolute; top:-30px; right:0; background:none; border:none; color:#fff; font-size:20px; cursor:pointer; }
.preview-img { max-width:90vw; max-height:90vh; border-radius:6px; }
.preview-video { max-width:90vw; max-height:90vh; border-radius:6px; }

.col-check { width:5%; text-align:center; }
.col-check input { accent-color:var(--accent-color); }
.col-path { width:43%; }
.col-path .path-text { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block; }
.col-size { width:13%; font-size:12px; }
.col-type { width:9%; font-size:12px; }
.col-date { width:21%; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.col-action { width:9%; text-align:center; }
.row-btn { border:none; background:transparent; cursor:pointer; font-size:14px; padding:2px 4px; border-radius:3px; }
.row-btn:hover { background:#f0f0f0; }

/* 加载 */
.loading-overlay {
  position:absolute; inset:0; display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:12px;
  background:rgba(255,255,255,.9); z-index:10; font-size:14px; color:var(--text-muted);
}
.loading-spinner {
  width:24px; height:24px; border:2px solid var(--border-color);
  border-top-color:var(--accent-color); border-radius:50%; animation:spin .8s linear infinite;
}
@keyframes spin { to { transform:rotate(360deg); } }

/* 状态栏 */
.statusbar {
  display:flex; align-items:center; justify-content:space-between;
  padding:6px 14px; border-top:1px solid var(--border-color); background:var(--bg-secondary); font-size:13px;
}
.status-path { color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:50%; }
.status-stats { display:flex; align-items:center; gap:16px; }
.stat { color:var(--text-muted); }
.stat strong { color:var(--accent-color); }
</style>
