<template>
  <footer class="status-bar">
    <div class="status-bar__left">
      <span v-if="store.currentPath" class="status-item">
        📂 {{ shortPath }}
      </span>
      <span v-else class="status-item status-item--muted">
        未选择文件夹
      </span>
    </div>
    <div class="status-bar__right">
      <span v-if="store.previewMode" class="status-item status-item--accent">
        匹配 {{ store.matchedCount }} / {{ store.totalCount }}
      </span>
      <span v-else class="status-item">
        共 {{ store.totalCount }} 项
      </span>
      <span v-if="store.selectedCount > 0" class="status-item status-item--selected">
        已选 {{ store.selectedCount }}
      </span>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFilePulseStore } from '@/stores/filepulse'

const store = useFilePulseStore()

const shortPath = computed(() => {
  const p = store.currentPath
  if (!p) return ''
  if (p.length <= 50) return p
  return '...' + p.slice(-47)
})
</script>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 28px;
  padding: 0 16px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-muted);
}

.status-bar__left,
.status-bar__right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-item {
  white-space: nowrap;
}

.status-item--muted {
  color: var(--text-muted);
}

.status-item--accent {
  color: var(--accent-color);
  font-weight: 500;
}

.status-item--selected {
  color: var(--accent-color);
  font-weight: 500;
}
</style>
