<template>
  <div class="dlg-overlay" @click.self="onCancel">
    <div class="dlg-box" :class="{ 'dlg-wide': wide }">
      <div class="dlg-header">
        <span class="dlg-title">{{ title }}</span>
        <button v-if="closable" class="dlg-close" @click="onCancel">✕</button>
      </div>
      <div class="dlg-body">
        <p v-if="typeof message === 'string' && !list" class="dlg-msg">{{ message }}</p>
        <div v-if="images && images.length > 0" class="dlg-thumbs">
          <div v-for="(img, i) in images" :key="i" class="dlg-thumb-item">
            <div class="dlg-thumb-row">
              <div class="dlg-thumb-side">
                <img :src="img.url" class="dlg-thumb-img" @error="onImgError($event)" />
                <span class="dlg-thumb-tag before">旋转前</span>
              </div>
              <span class="dlg-thumb-sep">→</span>
              <div class="dlg-thumb-side">
                <img :src="img.url" class="dlg-thumb-img" :style="{ transform: img.transform }" @error="onImgError($event)" />
                <span class="dlg-thumb-tag after">旋转后</span>
              </div>
            </div>
            <div class="dlg-thumb-name">{{ img.name }}</div>
          </div>
        </div>
        <ul v-if="list && list.length > 0" class="dlg-list">
          <li v-for="(item, i) in list" :key="i">{{ item }}</li>
          <li v-if="moreCount > 0" class="dlg-more">... 还有 {{ moreCount }} 项</li>
        </ul>
        <slot />
      </div>
      <div class="dlg-footer">
        <button v-if="showCancel" class="dlg-btn dlg-btn--cancel" @click="onCancel">{{ cancelText }}</button>
        <button v-if="kind !== 'info'" class="dlg-btn dlg-btn--confirm" :class="confirmClass" @click="onConfirm">{{ confirmText }}</button>
        <button v-else class="dlg-btn dlg-btn--confirm" @click="onConfirm">知道了</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  message?: string
  list?: string[]
  images?: { url: string; name: string; transform: string }[]
  moreCount?: number
  kind?: 'info' | 'warning' | 'danger'
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
  closable?: boolean
  wide?: boolean
}>(), {
  kind: 'info',
  confirmText: '确认',
  cancelText: '取消',
  showCancel: true,
  closable: true,
  wide: false,
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const confirmClass = computed(() => ({
  'dlg-btn--danger': props.kind === 'danger' || props.kind === 'warning',
}))

function onImgError(e: Event) {
  (e.target as HTMLImageElement).style.display = 'none'
}

function onConfirm() { emit('confirm') }
function onCancel() { emit('cancel') }
</script>

<style scoped>
.dlg-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,.45);
  display: flex; align-items: center; justify-content: center;
  animation: fadeIn .15s ease;
}
.dlg-box {
  background: #fff; border-radius: var(--radius-md, 8px);
  box-shadow: 0 6px 20px rgba(0,0,0,.12);
  min-width: 360px; max-width: 520px; width: fit-content;
  max-height: 80vh; display: flex; flex-direction: column;
  animation: slideUp .2s ease;
}
.dlg-wide { max-width: 640px; }
.dlg-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px 0;
}
.dlg-title {
  font-size: 15px; font-weight: 600; color: var(--text-primary, #333);
}
.dlg-close {
  border: none; background: none; color: #bbb; font-size: 16px;
  cursor: pointer; padding: 2px 6px; border-radius: 4px; line-height: 1;
}
.dlg-close:hover { color: #666; background: #f5f5f5; }
.dlg-body {
  padding: 12px 20px 20px; overflow-y: auto; flex: 1; min-height: 0;
  font-size: 14px; color: var(--text-secondary, #666); line-height: 1.6;
}
.dlg-msg { white-space: pre-line; }
.dlg-list {
  list-style: none; padding: 0; margin: 0; max-height: 240px; overflow-y: auto;
}
.dlg-list li {
  padding: 5px 8px; border-radius: 4px; font-size: 13px; color: var(--text-primary, #333);
  font-family: 'Consolas', 'Courier New', monospace;
  word-break: break-all;
}
.dlg-list li:nth-child(odd) { background: #fafafa; }
.dlg-more {
  color: var(--text-muted, #999); font-size: 12px; font-family: inherit;
  background: none !important; text-align: center; padding-top: 8px;
}
.dlg-thumbs { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; max-height: 360px; overflow-y: auto; }
.dlg-thumb-item { text-align: center; }
.dlg-thumb-row { display: flex; align-items: center; gap: 8px; }
.dlg-thumb-side { display: flex; flex-direction: column; align-items: center; }
.dlg-thumb-img {
  width: 140px; height: 105px; object-fit: cover; border-radius: 6px;
  border: 1px solid var(--border-color, #e0e0e0); background: #f5f5f5;
  transition: transform .2s;
}
.dlg-thumb-tag { font-size: 11px; margin-top: 4px; padding: 1px 8px; border-radius: 3px; }
.dlg-thumb-tag.before { background: #f0f0f0; color: #999; }
.dlg-thumb-tag.after { background: #e6f7ff; color: var(--accent-color, #1890ff); }
.dlg-thumb-sep { font-size: 18px; color: #ccc; flex-shrink: 0; }
.dlg-thumb-name { font-size: 12px; color: var(--text-secondary, #666); margin-top: 6px; max-width: 296px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dlg-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 0 20px 16px;
}
.dlg-btn {
  padding: 7px 20px; border-radius: 6px; font-size: 13px; font-weight: 500;
  cursor: pointer; border: 1px solid transparent; transition: all .15s;
}
.dlg-btn--cancel {
  background: #fff; color: var(--text-secondary, #666);
  border-color: var(--border-color, #e0e0e0);
}
.dlg-btn--cancel:hover { background: #f5f5f5; color: var(--text-primary, #333); }
.dlg-btn--confirm {
  background: var(--accent-color, #1890ff); color: #fff; border-color: transparent;
}
.dlg-btn--confirm:hover { background: var(--accent-hover, #40a9ff); }
.dlg-btn--danger {
  background: var(--danger-color, #ff4d4f);
}
.dlg-btn--danger:hover { background: var(--danger-hover, #ff7875); }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
</style>
