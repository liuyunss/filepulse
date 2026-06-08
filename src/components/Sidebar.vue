<template>
  <aside class="sidebar">
    <div class="sidebar__section">
      <div class="sidebar__label">文件夹</div>
      <button class="sidebar__btn" @click="selectFolder">
        <span>📂</span> 浏览选择
      </button>
      <button
        class="sidebar__btn sidebar__btn--drop"
        :class="{ 'sidebar__btn--active': dragging }"
      >
        <span>📁</span> 拖入文件夹
      </button>
      <div class="sidebar__path" v-if="store.currentPath" :title="store.currentPath">
        {{ shortPath }}
      </div>
      <label class="sidebar__checkbox">
        <input type="checkbox" v-model="store.recursive" @change="rescan" />
        <span>递归子目录</span>
      </label>
    </div>

    <div class="sidebar__section">
      <div class="sidebar__label">筛选条件</div>
      <div class="filter-list">
        <div v-for="(f, i) in store.filters" :key="f.filter_type" class="filter-item">
          <label class="filter-item__check">
            <input type="checkbox" v-model="f.enabled" />
            <span>{{ filterLabels[f.filter_type] }}</span>
          </label>
        </div>
      </div>
    </div>

    <div class="sidebar__section">
      <label class="sidebar__checkbox">
        <input type="checkbox" v-model="store.previewMode" />
        <span>▶ 预览匹配</span>
      </label>
    </div>

    <div class="sidebar__section">
      <div class="sidebar__label">文件夹解散</div>
      <label class="sidebar__checkbox">
        <input type="checkbox" v-model="store.dissolveMode" />
        <span>解散模式</span>
      </label>
      <div v-if="store.dissolveMode" class="dissolve-options">
        <span>保留</span>
        <select v-model.number="store.keepLevels" class="dissolve-select">
          <option :value="0">0</option>
          <option :value="1">1</option>
          <option :value="2">2</option>
          <option :value="3">3</option>
        </select>
        <span>级</span>
        <span class="dissolve-help" title="0=所有文件提到根目录, 1=保留一层子目录, ...">?</span>
      </div>
    </div>

    <div class="sidebar__section sidebar__rules">
      <RuleManager />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { open, confirm } from '@tauri-apps/plugin-dialog'
import { getCurrentWebview } from '@tauri-apps/api/webviewWindow'
import { useFilePulseStore } from '@/stores/filepulse'
import RuleManager from './RuleManager.vue'

const store = useFilePulseStore()
const dragging = ref(false)

// Tauri v2 drag-drop: get full file paths from native events
getCurrentWebview().onDragDropEvent((event) => {
  if (event.payload.type === 'drop' && event.payload.paths.length > 0) {
    store.scanFiles(event.payload.paths[0])
  }
  dragging.value = event.payload.type === 'over'
})

const filterLabels: Record<string, string> = {
  name: '名称',
  extension: '后缀',
  size: '大小',
  date: '日期',
  empty_dir: '空文件夹',
}

const shortPath = computed(() => {
  const p = store.currentPath
  if (p.length <= 40) return p
  return '...' + p.slice(-37)
})

async function selectFolder() {
  const selected = await open({ directory: true, multiple: false })
  if (selected) {
    store.scanFiles(selected)
  }
}

// Drag-drop is now handled by Tauri's onDragDropEvent above (imports)

async function rescan() {
  if (store.currentPath) {
    await store.scanFiles(store.currentPath)
  }
}
</script>

<style scoped>
.sidebar {
  width: 260px;
  min-width: 260px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 12px;
}

.sidebar__section {
  margin-bottom: 16px;
}

.sidebar__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.sidebar__btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
  margin-bottom: 6px;
}

.sidebar__btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.sidebar__btn--drop {
  border-style: dashed;
}

.sidebar__btn--active {
  border-color: var(--accent-color);
  background: #e6f7ff;
}

.sidebar__path {
  font-size: 11px;
  color: var(--text-muted);
  padding: 4px 8px;
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  word-break: break-all;
  line-height: 1.4;
  margin-bottom: 6px;
}

.sidebar__checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 0;
}

.sidebar__checkbox input {
  accent-color: var(--accent-color);
}

.filter-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-item__check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: background 0.15s;
}

.filter-item__check:hover {
  background: var(--bg-hover);
}

.filter-item__check input {
  accent-color: var(--accent-color);
}

.dissolve-options {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding-left: 8px;
  font-size: 13px;
}

.dissolve-select {
  width: 48px;
  padding: 2px 4px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 13px;
  background: white;
}

.dissolve-help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--bg-hover);
  color: var(--text-muted);
  font-size: 11px;
  cursor: help;
}

.sidebar__rules {
  margin-top: auto;
}
</style>
