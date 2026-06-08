<template>
  <div class="filter-panel" v-if="hasEnabledFilter">
    <div class="filter-panel__title">筛选条件</div>
    <div class="filter-panel__conditions">
      <!-- Name filter -->
      <div v-if="nameFilter?.enabled" class="condition-row">
        <span class="condition-label">名称</span>
        <select v-model="nameFilter.operator" class="condition-select">
          <option value="contains">包含</option>
          <option value="prefix">前缀</option>
          <option value="suffix">后缀</option>
        </select>
        <input
          v-model="nameFilter.value"
          class="condition-input"
          placeholder="关键词..."
        />
        <label class="condition-negate">
          <input type="checkbox" v-model="nameFilter.negate" />
          <span>取反</span>
        </label>
      </div>

      <!-- Extension filter -->
      <div v-if="extFilter?.enabled" class="condition-row">
        <span class="condition-label">后缀</span>
        <input
          v-model="extFilter.value"
          class="condition-input condition-input--wide"
          placeholder=".log,.tmp,.bak（逗号分隔）"
        />
        <label class="condition-negate">
          <input type="checkbox" v-model="extFilter.negate" />
          <span>取反</span>
        </label>
      </div>

      <!-- Size filter -->
      <div v-if="sizeFilter?.enabled" class="condition-row">
        <span class="condition-label">大小</span>
        <select v-model="sizeFilter.operator" class="condition-select">
          <option value=">">大于</option>
          <option value="<">小于</option>
          <option value="=">等于</option>
        </select>
        <input
          v-model="sizeFilter.value"
          class="condition-input condition-input--small"
          type="number"
          placeholder="0"
        />
        <select v-model="sizeFilter.unit" class="condition-select condition-select--small">
          <option value="KB">KB</option>
          <option value="MB">MB</option>
          <option value="GB">GB</option>
        </select>
        <label class="condition-negate">
          <input type="checkbox" v-model="sizeFilter.negate" />
          <span>取反</span>
        </label>
      </div>

      <!-- Date filter -->
      <div v-if="dateFilter?.enabled" class="condition-row">
        <span class="condition-label">日期</span>
        <select v-model="dateFilter.operator" class="condition-select">
          <option value="recent">最近</option>
          <option value="before">早于</option>
        </select>
        <input
          v-model="dateFilter.value"
          class="condition-input condition-input--small"
          type="number"
          placeholder="0"
        />
        <select v-model="dateFilter.unit" class="condition-select condition-select--small">
          <option value="hour">小时</option>
          <option value="day">天</option>
          <option value="month">月</option>
        </select>
        <label class="condition-negate">
          <input type="checkbox" v-model="dateFilter.negate" />
          <span>取反</span>
        </label>
      </div>

      <!-- Empty dir filter -->
      <div v-if="emptyFilter?.enabled" class="condition-row">
        <span class="condition-label">空文件夹</span>
        <span class="condition-hint">筛选空文件夹</span>
        <label class="condition-negate">
          <input type="checkbox" v-model="emptyFilter.negate" />
          <span>取反</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFilePulseStore } from '@/stores/filepulse'
import type { FilterCondition } from '@/types'

const store = useFilePulseStore()

const hasEnabledFilter = computed(() => store.filters.some(f => f.enabled))

const nameFilter = computed(() => store.filters.find(f => f.filter_type === 'name'))
const extFilter = computed(() => store.filters.find(f => f.filter_type === 'extension'))
const sizeFilter = computed(() => store.filters.find(f => f.filter_type === 'size'))
const dateFilter = computed(() => store.filters.find(f => f.filter_type === 'date'))
const emptyFilter = computed(() => store.filters.find(f => f.filter_type === 'empty_dir'))
</script>

<style scoped>
.filter-panel {
  padding: 10px 16px;
  background: #fafafa;
  border-bottom: 1px solid var(--border-color);
}

.filter-panel__title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.filter-panel__conditions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.condition-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.condition-label {
  width: 48px;
  color: var(--text-secondary);
  font-weight: 500;
  flex-shrink: 0;
}

.condition-hint {
  color: var(--text-muted);
  font-size: 12px;
}

.condition-select {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 13px;
  background: white;
  outline: none;
}

.condition-select--small {
  width: 72px;
}

.condition-input {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 13px;
  outline: none;
  flex: 1;
  max-width: 200px;
  transition: border-color 0.15s;
}

.condition-input--small {
  width: 80px;
  flex: none;
}

.condition-input--wide {
  max-width: 300px;
}

.condition-input:focus {
  border-color: var(--accent-color);
}

.condition-negate {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  white-space: nowrap;
}

.condition-negate input {
  accent-color: var(--accent-color);
}
</style>
