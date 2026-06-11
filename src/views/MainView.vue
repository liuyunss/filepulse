<template>
  <div class="main-view">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <img src="/icon.png" class="app-logo" alt="FilePulse" />
      <div class="tb-group">
        <button class="tb-btn" title="导入文件夹" @click="selectFolder">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="12" y1="11" x2="12" y2="17"/><polyline points="9 14 12 17 15 14"/>
          </svg>
        </button>
        <button class="tb-btn" title="筛选匹配" @click="applyPreview">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
        <button class="tb-btn tb-btn--danger" :disabled="store.selectedCount === 0" title="删除文件" @click="handleDelete">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
          </svg>
          <em v-if="store.selectedCount > 0">{{ store.selectedCount }}</em>
        </button>
      </div>
    </div>

    <!-- 空状态导入区域 -->
    <div v-if="store.files.length === 0 && !store.loading" class="table-scroll table-empty">
      <div class="import-zone" :class="{ over: dragging }" @click="selectFolder">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="12" y1="11" x2="12" y2="17"/><polyline points="9 14 12 17 15 14"/>
        </svg>
        <p>选择文件夹或拖拽到此处导入</p>
      </div>
    </div>

    <!-- 表格 -->
    <div v-else class="table-scroll">
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
            <td class="col-path"><span class="path-text" :title="relPath(file.path)">{{ relPath(file.path) }}</span></td>
            <td class="col-size">{{ formatSize(file.size) }}</td>
            <td class="col-type"><span class="type-tag" :style="{ background: fileColor(file), color:'#fff' }">{{ file.is_dir ? '文件夹' : file.extension.toUpperCase() || '-' }}</span></td>
            <td class="col-date" :title="file.modified">{{ file.modified }}</td>
            <td class="col-action">
              <button v-if="isPreviewable(file)" class="row-btn" @click.stop="openPreview(file)" title="预览">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </button>
              <button class="row-btn" @click.stop="openInExplorer(file.path)" title="打开位置">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 预览模态框 -->
    <div v-if="previewItem" class="preview-overlay" @click="previewItem = null">
      <div class="preview-box" @click.stop>
        <button class="preview-close" @click="previewItem = null">✕</button>
        <img v-if="previewType === 'image'" :src="previewUrl" class="preview-img" />
        <video v-else-if="previewType === 'video'" :src="previewUrl" controls preload="metadata" class="preview-video" />
      </div>
    </div>

    <!-- 自定义弹框 -->
    <DialogBox
      v-if="dlg.title"
      :title="dlg.title"
      :message="dlg.message"
      :list="dlg.list"
      :images="dlg.images"
      :more-count="dlg.moreCount"
      :kind="dlg.kind"
      :confirm-text="dlg.confirmText"
      :cancel-text="dlg.cancelText"
      :show-cancel="dlg.showCancel"
      :wide="dlg.wide"
      @confirm="resolveDlg(true)"
      @cancel="resolveDlg(false)"
    />

    <!-- 加载中 — 进度条严格在底部 statusbar 内 -->
    <div v-if="store.loading" class="loading-overlay">
      <div class="loading-spinner" />
      <span class="loading-text">{{ loadingText }}</span>
    </div>

    <!-- 底部状态栏 -->
    <div class="statusbar">
      <div class="status-left">
        <span class="status-path" :title="store.currentPath">{{ store.currentPath || '未选择文件夹' }}</span>
        <button v-if="store.currentPath" class="clear-btn" @click="clearList" title="清空列表">✕</button>
      </div>

      <!-- 进度状态 — 在状态栏右侧，stats 旁边 -->
      <Transition name="progress-fade">
        <div v-if="store.progress.active" class="status-progress" :class="{ 'fade-out': store.progress.fadeOut }">
          <span class="progress-label">{{ progressLabel }}</span>
          <div class="progress-bar-wrap">
            <!-- Indeterminate: infinite animation when total is 0 -->
            <div v-if="store.progress.total === 0" class="progress-bar-track progress-bar-indeterminate">
              <div class="progress-bar-fill-indeterminate" />
            </div>
            <!-- Determinate: precise progress bar -->
            <div v-else class="progress-bar-track">
              <div class="progress-bar-fill" :style="{ width: progressPercent + '%' }" />
            </div>
          </div>
          <span class="progress-time">已用 {{ store.progress.elapsed }}</span>
          <span v-if="store.progress.total > 0" class="progress-remaining">剩余 {{ formatRemaining(store.progress.total - store.progress.processed) }}</span>
          <span v-if="store.progress.estimated" class="progress-eta">预计 {{ store.progress.estimated }}</span>
        </div>
      </Transition>

      <div class="status-stats">
        <span class="stat">选中 <strong>{{ store.selectedCount }}</strong></span>
        <span class="stat">筛选 <strong>{{ store.previewMode ? store.matchedCount : store.totalCount }}</strong></span>
        <span class="stat">总数 <strong>{{ store.totalCount }}</strong></span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { useFilePulseStore } from '@/stores/filepulse'
import DialogBox from '@/components/DialogBox.vue'

const store = useFilePulseStore()
const dragging = ref(false)
const isScanning = ref(false)
const previewItem = ref<any>(null)
const previewType = ref('')
const previewUrl = ref('')

// Custom dialog system
interface DlgState {
  title: string
  message?: string
  list?: string[]
  images?: { url: string; name: string; transform: string; isVideo?: boolean }[]
  moreCount?: number
  kind?: 'info' | 'warning' | 'danger'
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
  wide?: boolean
}
const dlg = ref<DlgState>({} as DlgState)
let dlgResolve: ((v: boolean) => void) | null = null

function showDialog(opts: DlgState): Promise<boolean> {
  return new Promise(resolve => {
    dlgResolve = resolve
    dlg.value = opts
  })
}
function resolveDlg(v: boolean) {
  dlg.value = {} as DlgState
  dlgResolve?.(v)
  dlgResolve = null
}

const typeColors: Record<string, string> = {
  image: '#52c41a', video: '#ff4d4f', audio: '#722ed1',
  doc: '#1890ff', archive: '#fa8c16', code: '#0ea5e9', exe: '#8c8c8c', folder: '#d9d9d9',
}

const allSelected = computed(() => {
  const all = store.filteredFiles.map(f => f.path)
  return all.length > 0 && all.every(p => store.selectedPaths.has(p))
})

function sortIcon(key: string) { return store.sortKey === key ? (store.sortAsc ? '↑' : '↓') : '' }

function relPath(fullPath: string): string {
  if (!store.currentPath) return fullPath
  const root = store.currentPath.replace(/\\/g, '/').replace(/\/$/, '')
  const fp = fullPath.replace(/\\/g, '/')
  if (fp.startsWith(root + '/')) return fp.slice(root.length + 1)
  if (fp === root) return ''
  return fp
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0'
  const u = ['', 'K', 'M', 'G', 'T']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const v = bytes / Math.pow(1024, i)
  return (i > 0 ? v.toFixed(1) : v.toFixed(0)) + ' ' + u[i]
}

function formatRemaining(count: number): string {
  return count.toLocaleString()
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
  return ['jpg','jpeg','png','gif','bmp','svg','webp','ico','mp4','avi','mkv','mov','webm'].includes(ext)
}

async function openPreview(file: any) {
  previewItem.value = file
  const img = ['jpg','jpeg','png','gif','bmp','svg','webp','ico']
  const ext = file.extension.toLowerCase()
  const isImg = img.includes(ext)
  try {
    const { convertFileSrc } = await import('@tauri-apps/api/core')
    previewUrl.value = convertFileSrc(file.path)
  } catch {
    // fallback: show filename in the overlay
  }
  previewType.value = isImg ? 'image' : 'video'
}

async function openInExplorer(path: string) {
  try {
    await invoke('show_in_folder', { path })
  } catch (e) { console.error('openInExplorer failed:', e) }
}

// ─── Progress display helpers ───────────────────────
const progressPercent = computed(() => {
  const p = store.progress
  if (p.total <= 0) return 0
  return Math.min(100, Math.round((p.processed / p.total) * 100))
})

const loadingText = computed(() => {
  if (!store.progress.active) return '加载中...'
  switch (store.progress.operation) {
    case 'scan': return '扫描中...'
    case 'delete': return '删除中...'
    case 'dissolve': return '解散文件夹...'
    case 'dedupe': return '查找重复文件...'
    default: return '处理中...'
  }
})

const progressLabel = computed(() => {
  switch (store.progress.operation) {
    case 'scan': return '扫描中...'
    case 'delete': return '删除中...'
    case 'dissolve': return '解散中...'
    case 'dedupe': return '去重中...'
    default: return '处理中...'
  }
})

async function applyPreview() {
  // Tool mode: dissolve folder
  if (store.dissolveMode) {
    store.loading = true
    try {
      const preview = await store.dissolvePreview()
      store.loading = false
      if (preview.length === 0) {
        await showDialog({ title: '解散文件夹', message: '没有需要解散的文件。', showCancel: false })
        return
      }
      const moves = preview.filter(r => r.action === 'move')
      const skips = preview.filter(r => r.action === 'skip')
      if (moves.length === 0) {
        await showDialog({ title: '解散文件夹', message: '没有需要移动的文件（均为重复文件）。', showCancel: false })
        return
      }
      const items = [
        ...moves.map(r => `${r.name}  →  ${r.target}`),
        ...skips.map(r => `${r.name}  ⤏ 跳过（重复文件）`),
      ]
      const ok = await showDialog({
        title: `解散文件夹 · ${moves.length} 个移动` + (skips.length > 0 ? ` · ${skips.length} 个跳过` : ''),
        message: '以下文件将被移动：',
        list: items,
        kind: 'warning',
        confirmText: '执行解散',
        wide: true,
      })
      if (ok) {
        store.loading = true
        const results = await store.dissolveExecute()
        store.loading = false
        const moved = results.filter(r => r.action === 'move').length
        await showDialog({
          title: '解散完成',
          message: `成功移动 ${moved} 个文件`,
          showCancel: false,
        })
      }
    } catch (e: any) { store.loading = false; console.error(e) }
    return
  }

  // Tool mode: delete empty folders
  if (store.deleteEmpty) {
    store.loading = true
    try {
      const result = await store.deleteEmptyDirs()
      store.loading = false
      const total = result.deleted.length + result.failed.length
      if (total === 0) {
        await showDialog({ title: '删除空文件夹', message: '没有找到空文件夹', showCancel: false })
      } else {
        await showDialog({
          title: '删除空文件夹',
          message: `已删除 ${result.deleted.length} 个空文件夹` + (result.failed.length > 0 ? `\n${result.failed.length} 个删除失败` : ''),
          showCancel: false,
        })
      }
    } catch (e: any) { store.loading = false; console.error(e) }
    return
  }

  // Tool mode: rotate selected images
  if (store.rotateMode) {
    if (store.selectedCount === 0) {
      await showDialog({ title: '旋转图片', message: '请先在列表中选中要旋转的图片', showCancel: false })
      return
    }
    store.loading = true
    try {
      const preview = await store.previewRotate()
      store.loading = false
      if (preview.length === 0) {
        await showDialog({ title: '旋转图片', message: '选中的文件均不支持旋转（仅支持 JPEG / MP4 / MOV 格式）', showCancel: false })
        return
      }
      const dir = store.rotateDir === 'cw' ? '顺时针' : '逆时针'
      const angle = store.rotateAngle
      const deg = store.rotateDir === 'cw' ? angle : -angle
      const isVideo = (p: string) => /\.(mp4|mov)$/i.test(p)
      const imageItems = await Promise.all(preview.map(async r => {
        let url = ''
        if (!isVideo(r.path)) {
          try {
            const { convertFileSrc } = await import('@tauri-apps/api/core')
            url = convertFileSrc(r.path)
          } catch {}
        }
        return { url, name: relPath(r.path), transform: `rotate(${deg}deg)`, isVideo: isVideo(r.path) }
      }))
      const ok = await showDialog({
        title: `旋转预览 · ${dir}${angle}°`,
        message: `左侧为旋转前，右侧为旋转后预览：`,
        images: imageItems,
        kind: 'warning',
        confirmText: '确认旋转',
        cancelText: '取消',
        wide: true,
      })
      if (ok) {
        store.loading = true
        await store.rotateSelectedFiles()
        store.loading = false
        await showDialog({ title: '旋转完成', message: `已处理 ${preview.length} 张图片`, showCancel: false })
      }
    } catch (e: any) { store.loading = false; console.error(e) }
    return
  }

  // Tool mode: find duplicate files
  if (store.dedupeMode) {
    store.loading = true
    try {
      const groups = await store.findDuplicates()
      store.loading = false
      if (groups.length === 0) {
        await showDialog({ title: '查找重复文件', message: '没有发现重复文件', showCancel: false })
        return
      }
      const totalFiles = groups.reduce((s, g) => s + g.files.length, 0)
      const items = groups.map((g, i) => {
        const sz = formatSize(g.size)
        return `[${sz}] ${g.files.map(f => relPath(f.path)).join('  =  ')}`
      })
      const ok = await showDialog({
        title: `重复文件 · ${groups.length} 组 · ${totalFiles} 个文件`,
        message: '每组选择保留最新或最旧的文件：',
        list: items,
        kind: 'warning',
        confirmText: '保留最新的',
        cancelText: '保留最旧的',
        wide: true,
      })
      // ok=true → keep newest, ok=false → keep oldest
      store.loading = true
      const keepNewest = ok
      const toDelete: string[] = []
      for (const g of groups) {
        const sorted = [...g.files].sort((a, b) => {
          const d = a.modified.localeCompare(b.modified)
          if (d !== 0) return keepNewest ? -d : d
          return a.path.length - b.path.length
        })
        const kept = sorted[0]
        toDelete.push(...sorted.slice(1).map(f => f.path))
      }
      const deleted = await store.deleteDuplicates(toDelete)
      store.loading = false
      await showDialog({
        title: '去重完成',
        message: `删除了 ${deleted} 个重复文件，保留了 ${groups.length} 个文件`,
        showCancel: false,
      })
    } catch (e: any) { store.loading = false; console.error(e) }
    return
  }

  // Normal mode: toggle filter preview
  store.previewMode = !store.previewMode
}

function clearList() { store.files = []; store.currentPath = ''; store.selectedPaths.clear(); store.previewMode = false }

let dragDropUnlisten: (() => void) | null = null

onMounted(async () => {
  try {
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const webview = getCurrentWebviewWindow()
    dragDropUnlisten = await webview.onDragDropEvent((event: any) => {
      const type = event.payload.type
      // Handle drag state
      if (type === 'over') { dragging.value = true }
      else if (type === 'leave' || type === 'drop') { dragging.value = false }

      // Handle drop — guard against duplicate events (Tauri v2 Windows bug)
      if (type === 'drop' && event.payload.paths?.length > 0 && !isScanning.value) {
        isScanning.value = true
        store.scanFiles(event.payload.paths[0]).finally(() => {
          isScanning.value = false
        })
      }
    })
  } catch (e) {}
})

onUnmounted(() => {
  dragDropUnlisten?.()
  dragDropUnlisten = null
})

async function selectFolder() {
  const selected = await open({ directory: true, multiple: false })
  if (selected) store.scanFiles(selected)
}

async function handleDelete() {
  const ok = await showDialog({
    title: '删除确认',
    message: `确认删除选中的 ${store.selectedCount} 个文件？\n文件将移至回收站，可手动恢复。`,
    kind: 'danger',
    confirmText: '确认删除',
    cancelText: '取消',
  })
  if (ok) await store.deleteSelected()
}
</script>

<style scoped>
.main-view { display:flex; flex-direction:column; height:100%; overflow:hidden; }

.toolbar { display:flex; align-items:center; padding:0 8px 0 14px; border-bottom:1px solid var(--border-color); background:var(--bg-secondary); height:40px; user-select:none; }
.app-logo { width: 24px; height: 24px; border-radius: 5px; margin-right: 4px; flex-shrink: 0; }
.tb-group { display:flex; align-items:center; gap:4px; }
.tb-btn {
  display:flex; align-items:center; justify-content:center;
  width:38px; height:34px; border:1px solid transparent; border-radius:6px;
  background:transparent; color:var(--text-secondary); cursor:pointer; transition:all .15s; position:relative;
}
.tb-btn:hover:not(:disabled) { background:var(--bg-hover); color:var(--text-primary); }
.tb-btn--danger:hover:not(:disabled) { background:#fff1f0; color:var(--danger-color); }
.tb-btn:disabled { opacity:.3; cursor:not-allowed; }
.tb-btn em { position:absolute; top:-2px; right:-2px; font-style:normal; font-size:10px; background:var(--danger-color); color:#fff; border-radius:8px; padding:0 5px; line-height:15px; min-width:16px; text-align:center; }

.table-scroll { flex:1; overflow-y:auto; }
.table-scroll.table-empty { display:flex; align-items:center; justify-content:center; overflow:hidden; }
.file-table { width:96%; margin:0 2%; border-collapse:separate; border-spacing:0 3px; font-size:13px; table-layout:fixed; }
.file-table thead { position:sticky; top:0; z-index:2; }
.file-table th {
  position:sticky; top:0; background:#eef2fb; padding:7px 10px;
  text-align:left; font-weight:600; font-size:12px; color:#5a6a85;
  border-bottom:1px solid #d0d9f0; white-space:nowrap; user-select:none; box-sizing:border-box;
}
.file-table th.sortable { cursor:pointer; }
.file-table th.sortable:hover { color:var(--accent-color); }
.file-table th:first-child { box-shadow:-2.1vw 0 0 #eef2fb; }
.file-table th:last-child { box-shadow:2.1vw 0 0 #eef2fb; }
.file-table td { padding:6px 10px; background:#fff; border-top:1px solid #eef0f5; border-bottom:1px solid #eef0f5; box-sizing:border-box; }
.file-table td:first-child { border-left:1px solid #eef0f5; border-radius:4px 0 0 4px; }
.file-table td:last-child { border-right:1px solid #eef0f5; border-radius:0 4px 4px 0; background:#fff; }
.file-table td.col-check { border-left:3px solid #d9d9d9; }
.file-table tr.selected td { background:#e6f7ff; border-color:#bae0ff; }
.file-table tr.selected td:last-child { background:#e6f7ff; }


.import-zone {
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px;
  padding:48px 72px; border:2px dashed #d9d9d9; border-radius:12px;
  cursor:pointer; color:#bbb; transition:all .2s;
  max-width:380px; background:#fff;
}
.import-zone:hover { border-color:var(--accent-color); color:var(--accent-color); background:#fafcff; }
.import-zone.over { border-color:var(--accent-color); color:var(--accent-color); background:#e6f7ff; }
.import-zone p { font-size:14px; }

.col-check { width:5%; text-align:center; }
.col-check input { accent-color:var(--accent-color); }
.col-path { width:46%; }
.col-path .path-text { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block; }
.col-size { width:10%; font-size:12px; }
.col-type { width:7%; font-size:12px; }
.col-date { width:20%; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.col-action { width:12%; text-align:center; }

.type-tag { font-size:11px; padding:2px 6px; border-radius:3px; font-weight:500; }
.row-btn { border:none; background:transparent; cursor:pointer; padding:2px 4px; border-radius:3px; display:inline-flex; }
.row-btn:hover { background:#f0f0f0; }

.preview-overlay { position:fixed; inset:0; background:rgba(0,0,0,.7); z-index:100; display:flex; align-items:center; justify-content:center; cursor:pointer; }
.preview-box { max-width:90vw; max-height:90vh; position:relative; cursor:default; }
.preview-close { position:absolute; top:-30px; right:0; background:none; border:none; color:#fff; font-size:20px; cursor:pointer; }
.preview-img { max-width:90vw; max-height:90vh; border-radius:6px; }
.preview-video { max-width:90vw; max-height:90vh; border-radius:6px; }

/* Loading overlay */
.loading-overlay {
  position:absolute; inset:0; display:flex; flex-direction:column; align-items:center;
  justify-content:center; gap:12px; background:rgba(255,255,255,.92); z-index:10;
  font-size:14px; color:var(--text-muted);
}
.loading-spinner {
  width:28px; height:28px; border:2.5px solid var(--border-color);
  border-top-color:var(--accent-color); border-radius:50%; animation:spin .8s linear infinite;
}
.loading-text { font-size:14px; font-weight:500; }
@keyframes spin { to { transform:rotate(360deg); } }

/* Status bar */
.statusbar {
  display:flex; align-items:center; justify-content:space-between;
  padding:6px 14px; border-top:1px solid var(--border-color);
  background:var(--bg-secondary); font-size:13px; min-height:32px;
}
.status-left { display:flex; align-items:center; gap:8px; max-width:40%; }
.status-path { color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.clear-btn { border:none; background:transparent; color:var(--text-muted); cursor:pointer; font-size:14px; padding:0 4px; flex-shrink:0; }
.clear-btn:hover { color:var(--danger-color); }
.status-stats { display:flex; align-items:center; gap:16px; flex-shrink:0; }
.stat { color:var(--text-muted); }
.stat strong { color:var(--accent-color); }

/* Progress in status bar */
.status-progress {
  display:flex; align-items:center; gap:8px; flex-shrink:0;
  padding:0 12px; border-left:1px solid var(--border-color);
  transition: opacity 0.3s ease;
}
.status-progress.fade-out { opacity: 0; }
.progress-label { font-size:12px; font-weight:500; color:var(--accent-color); white-space:nowrap; }
.progress-bar-wrap { width:120px; flex-shrink:0; }
.progress-bar-track {
  height:4px; background:#e8e8e8; border-radius:2px; overflow:hidden;
}
.progress-bar-fill {
  height:100%; background:var(--accent-color); border-radius:2px;
  transition: width 0.3s ease;
}

/* Indeterminate progress bar animation */
.progress-bar-indeterminate {
  position:relative; overflow:hidden;
}
.progress-bar-fill-indeterminate {
  position:absolute; top:0; left:0; width:40%; height:100%;
  background:var(--accent-color); border-radius:2px;
  animation: indeterminate 1.5s ease-in-out infinite;
}
@keyframes indeterminate {
  0% { left: -40%; }
  100% { left: 100%; }
}

.progress-time { font-size:11px; color:var(--text-muted); white-space:nowrap; }
.progress-remaining { font-size:11px; color:var(--text-muted); white-space:nowrap; }
.progress-eta { font-size:11px; color:var(--accent-color); white-space:nowrap; font-weight:500; }

/* Fade transition */
.progress-fade-enter-active { transition: opacity 0.2s ease; }
.progress-fade-leave-active { transition: opacity 0.3s ease; }
.progress-fade-enter-from, .progress-fade-leave-to { opacity: 0; }
</style>
