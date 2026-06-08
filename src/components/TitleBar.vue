<template>
  <div class="title-bar" data-tauri-drag-region>
    <div class="title-bar__title">
      <span class="title-bar__icon">📁</span>
      <span>FilePulse</span>
    </div>
    <div class="title-bar__actions">
      <button class="title-btn" @click="minimize">
        <svg width="12" height="12" viewBox="0 0 12 12"><rect y="5" width="12" height="1" fill="currentColor"/></svg>
      </button>
      <button class="title-btn" @click="toggleMaximize">
        <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1"/></svg>
      </button>
      <button class="title-btn title-btn--close" @click="close">
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1L11 11M11 1L1 11" stroke="currentColor" stroke-width="1.5"/></svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getCurrentWindow } from '@tauri-apps/api/window'

const win = getCurrentWindow()

function minimize() { win.minimize() }
function toggleMaximize() { win.toggleMaximize() }
function close() { win.close() }
</script>

<style scoped>
.title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  background: #ffffff;
  border-bottom: 1px solid var(--border-color);
  user-select: none;
  padding: 0 8px;
}

.title-bar__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  padding-left: 4px;
}

.title-bar__icon {
  font-size: 16px;
}

.title-bar__actions {
  display: flex;
  gap: 2px;
}

.title-btn {
  width: 32px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s;
}

.title-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.title-btn--close:hover {
  background: var(--danger-color);
  color: white;
}
</style>
