<template>
  <div class="rule-manager">
    <div class="sidebar__label">规则管理</div>
    <div class="rule-list">
      <div v-for="rule in store.rules" :key="rule.id" class="rule-item">
        <div class="rule-item__info" @click="store.loadRule(rule)">
          <div class="rule-item__name">{{ rule.name }}</div>
          <div class="rule-item__summary">{{ ruleSummary(rule) }}</div>
        </div>
        <button class="rule-item__delete" @click="store.deleteRule(rule.id)">✕</button>
      </div>
      <div v-if="store.rules.length === 0" class="rule-empty">
        暂无保存的规则
      </div>
    </div>
    <div class="rule-save">
      <input
        v-model="ruleName"
        class="rule-input"
        placeholder="输入规则名称..."
        @keyup.enter="saveRule"
      />
      <button class="rule-save-btn" @click="saveRule" :disabled="!ruleName.trim()">
        💾 保存
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useFilePulseStore } from '@/stores/filepulse'
import type { FilterRule } from '@/types'

const store = useFilePulseStore()
const ruleName = ref('')

onMounted(() => {
  store.loadRules()
})

function ruleSummary(rule: FilterRule): string {
  const active = rule.filters.filter(f => f.enabled)
  if (active.length === 0) return '无条件'
  return active.map(f => {
    switch (f.filter_type) {
      case 'name': return `名称${f.operator}:${f.value}`
      case 'extension': return `后缀:${f.value}`
      case 'size': return `大小${f.operator}:${f.value}${f.unit}`
      case 'date': return `日期${f.operator}:${f.value}${f.unit}`
      case 'empty_dir': return '空文件夹'
      default: return f.filter_type
    }
  }).join(' | ')
}

function saveRule() {
  const name = ruleName.value.trim()
  if (!name) return
  store.saveRule(name)
  ruleName.value = ''
}
</script>

<style scoped>
.rule-manager {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rule-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.rule-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s;
}

.rule-item:hover {
  border-color: var(--accent-color);
}

.rule-item__info {
  flex: 1;
  min-width: 0;
}

.rule-item__name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.rule-item__summary {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rule-item__delete {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 50%;
  font-size: 12px;
  transition: all 0.15s;
}

.rule-item__delete:hover {
  background: var(--danger-color);
  color: white;
}

.rule-empty {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 8px;
}

.rule-save {
  display: flex;
  gap: 6px;
}

.rule-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s;
}

.rule-input:focus {
  border-color: var(--accent-color);
}

.rule-save-btn {
  padding: 6px 10px;
  border: 1px solid var(--accent-color);
  border-radius: var(--radius-sm);
  background: var(--accent-color);
  color: white;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.rule-save-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.rule-save-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
