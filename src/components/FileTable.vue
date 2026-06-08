<template>
  <div class="file-table">
    <div class="file-table__toolbar">
      <div class="file-table__actions">
        <button
          class="action-btn"
          :disabled="store.selectedCount === 0"
          @click="handleDelete"
        >
          🗑️ 删除选中 ({{ store.selectedCount }})
        </button>
        <button
          v-if="store.dissolveMode"
          class="action-btn action-btn--primary"
          @click="handleDissolve"
        >
          📂 解散预览
        </button>
      </div>
    </div>

    <div class="file-table__container">
      <table class="file-table__table">
        <thead>
          <tr>
            <th class="col-check">
              <input
                type="checkbox"
                :checked="allSelected"
                @change="store.selectAll"
              />
            </th>
            <th class="col-name" @click="store.setSort('name')">
              路径 {{ sortIcon('name') }}
            </th>
            <th class="col-size" @click="store.setSort('size')">
              大小 {{ sortIcon('size') }}
            </th>
            <th class="col-type" @click="store.setSort('extension')">
              类型 {{ sortIcon('extension') }}
            </th>
            <th class="col-date" @click="store.setSort('modified')">
              修改时间 {{ sortIcon('modified') }}
            </th>
            <th class="col-action">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="file in store.filteredFiles"
            :key="file.path"
            :class="{ 'row-selected': store.selectedPaths.has(file.path) }"
            @click="store.toggleSelect(file.path)"
          >
            <td class="col-check">
              <input
                type="checkbox"
                :checked="store.selectedPaths.has(file.path)"
                @click.stop
                @change="store.toggleSelect(file.path)"
              />
            </td>
            <td class="col-name" :title="file.path">
              <span class="file-icon">{{ file.is_dir ? '📁' : getFileIcon(file.extension) }}</span>
              {{ file.name }}
            </td>
            <td class="col-size">{{ file.is_dir ? '-' : formatSize(file.size) }}</td>
            <td class="col-type">{{ file.is_dir ? '文件夹' : file.extension.toUpperCase() || '-' }}</td>
            <td class="col-date">{{ file.modified }}</td>
            <td class="col-action">
              <button class="action-btn action-btn--small" @click.stop="openInExplorer(file.path)">
                📂
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="store.files.length === 0 && !store.loading" class="file-table__empty">
        <div class="empty-icon">📂</div>
        <div class="empty-text">选择或拖入文件夹开始扫描</div>
      </div>

      <div v-if="store.loading" class="file-table__loading">
        <div class="loading-spinner"></div>
        <div>扫描中...</div>
      </div>
    </div>

    <!-- Dissolve Preview Modal -->
    <n-modal v-model:show="showDissolveModal" preset="dialog" title="解散预览" :show-icon="false" style="width: 600px">
      <div class="dissolve-preview">
        <div v-if="dissolveResults.length === 0" class="dissolve-empty">
          没有需要移动的文件
        </div>
        <table v-else class="dissolve-table">
          <thead>
            <tr>
              <th>原路径</th>
              <th>→</th>
              <th>新路径</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in dissolveResults" :key="i">
              <td class="dissolve-original">{{ shortPath(r.original) }}</td>
              <td>→</td>
              <td class="dissolve-new">{{ shortPath(r.new_path) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <template #action>
        <n-button @click="showDissolveModal = false">取消</n-button>
        <n-button type="primary" @click="confirmDissolve" :disabled="dissolveResults.length === 0">
          确认解散
        </n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NModal, NButton, useMessage } from 'naive-ui'
import { confirm } from '@tauri-apps/plugin-dialog'
import { useFilePulseStore } from '@/stores/filepulse'
import { open as shellOpen } from '@tauri-apps/plugin-shell'
import type { DissolveResult } from '@/types'

const store = useFilePulseStore()
const message = useMessage()
const showDissolveModal = ref(false)
const dissolveResults = ref<DissolveResult[]>([])

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

function getFileIcon(ext: string): string {
  const icons: Record<string, string> = {
    pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗',
    ppt: '📙', pptx: '📙', txt: '📄', md: '📝',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️',
    mp3: '🎵', wav: '🎵', flac: '🎵',
    mp4: '🎬', avi: '🎬', mkv: '🎬',
    zip: '📦', rar: '📦', '7z': '📦',
    exe: '⚙️', msi: '⚙️',
    js: '📜', ts: '📜', py: '📜', java: '📜',
  }
  return icons[ext.toLowerCase()] || '📄'
}

function shortPath(p: string): string {
  if (p.length <= 50) return p
  const parts = p.split(/[/\\]/)
  if (parts.length <= 3) return p
  return parts[0] + '/.../' + parts.slice(-2).join('/')
}

async function handleDelete() {
  const count = store.selectedCount
  if (count === 0) return

  try {
    const confirmed = await confirm(
      `确定删除选中的 ${count} 个文件/文件夹？`,
      { title: '确认删除' }
    )
    if (!confirmed) return
  } catch {
    // If confirm dialog is unavailable, proceed only if explicitly supported
    return
  }

  const deletedCount = await store.deleteSelected()
  if (deletedCount > 0) {
    message.success(`已删除 ${deletedCount} 个项目`)
  } else if (count > 0) {
    message.warning('所有文件删除失败')
  }
}

async function handleDissolve() {
  dissolveResults.value = await store.dissolvePreview()
  showDissolveModal.value = true
}

async function confirmDissolve() {
  await store.dissolveExecute()
  showDissolveModal.value = false
  message.success('文件夹解散完成')
}

async function openInExplorer(path: string) {
  try {
    await shellOpen(path)
  } catch (e) {
    console.error('Open in explorer failed:', e)
  }
}
</script>

<style scoped>
.file-table {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.file-table__toolbar {
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.file-table__actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover:not(:disabled) {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-btn--primary {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.action-btn--primary:hover {
  background: var(--accent-hover);
}

.action-btn--small {
  padding: 2px 8px;
  font-size: 14px;
}

.file-table__container {
  flex: 1;
  overflow: auto;
}

.file-table__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.file-table__table thead {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.file-table__table th {
  padding: 8px 12px;
  text-align: left;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.file-table__table th:hover {
  color: var(--text-primary);
}

.file-table__table td {
  padding: 6px 12px;
  border-bottom: 1px solid #f0f0f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.file-table__table tbody tr:hover {
  background: #f5f7fa;
}

.file-table__table tbody tr.row-selected {
  background: #e6f7ff;
}

.col-check {
  width: 36px;
  text-align: center;
}

.col-check input {
  accent-color: var(--accent-color);
}

.col-name {
  min-width: 200px;
}

.col-size {
  width: 100px;
  text-align: right;
}

.col-type {
  width: 80px;
}

.col-date {
  width: 160px;
}

.col-action {
  width: 50px;
  text-align: center;
}

.file-icon {
  margin-right: 4px;
}

.file-table__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 14px;
}

.file-table__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  gap: 12px;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Dissolve Preview Modal */
.dissolve-preview {
  max-height: 400px;
  overflow-y: auto;
}

.dissolve-empty {
  text-align: center;
  color: var(--text-muted);
  padding: 24px;
}

.dissolve-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.dissolve-table th {
  padding: 6px 8px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
  font-weight: 500;
}

.dissolve-table td {
  padding: 4px 8px;
  border-bottom: 1px solid #f0f0f0;
  word-break: break-all;
}

.dissolve-original {
  color: var(--text-muted);
  text-decoration: line-through;
}

.dissolve-new {
  color: var(--accent-color);
}
</style>
