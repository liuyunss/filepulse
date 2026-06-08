import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FileItem, FilterCondition, FilterRule, DissolveResult } from '@/types'
import { invoke } from '@tauri-apps/api/core'

export const useFilePulseStore = defineStore('filepulse', () => {
  // State
  const files = ref<FileItem[]>([])
  const selectedPaths = ref<Set<string>>(new Set())
  const currentPath = ref('')
  const recursive = ref(true)
  const loading = ref(false)
  const previewMode = ref(false)

  // Filters
  const filters = ref<FilterCondition[]>([
    { filter_type: 'name', enabled: false, operator: 'contains', value: '', negate: false },
    { filter_type: 'extension', enabled: false, value: '', negate: false },
    { filter_type: 'size', enabled: false, operator: '>', value: '', unit: 'MB', negate: false },
    { filter_type: 'date', enabled: false, operator: 'recent', value: '', unit: 'day', negate: false },
    { filter_type: 'empty_dir', enabled: false, negate: false },
  ])

  // Dissolve
  const dissolveMode = ref(false)
  const keepLevels = ref(1)

  // Rules
  const rules = ref<FilterRule[]>([])

  // Sort
  const sortKey = ref<'name' | 'size' | 'modified' | 'extension'>('name')
  const sortAsc = ref(true)

  // Computed
  const filteredFiles = computed(() => {
    let result = files.value

    if (previewMode.value) {
      result = result.filter(file => matchesFilters(file))
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0
      switch (sortKey.value) {
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'size': cmp = a.size - b.size; break
        case 'modified': cmp = a.modified.localeCompare(b.modified); break
        case 'extension': cmp = a.extension.localeCompare(b.extension); break
      }
      return sortAsc.value ? cmp : -cmp
    })

    return result
  })

  const selectedCount = computed(() => selectedPaths.value.size)
  const totalCount = computed(() => files.value.length)
  const matchedCount = computed(() => {
    if (!previewMode.value) return 0
    return files.value.filter(f => matchesFilters(f)).length
  })

  // Methods
  async function scanFiles(path: string) {
    loading.value = true
    currentPath.value = path
    try {
      files.value = await invoke<FileItem[]>('scan_files', {
        options: { path, recursive: recursive.value }
      })
      selectedPaths.value.clear()
    } catch (e) {
      console.error('Scan failed:', e)
      files.value = []
    } finally {
      loading.value = false
    }
  }

  function matchesFilters(file: FileItem): boolean {
    for (const filter of filters.value) {
      if (!filter.enabled) continue

      let match = false
      switch (filter.filter_type) {
        case 'name': {
          const val = filter.value?.toLowerCase() || ''
          const name = file.name.toLowerCase()
          switch (filter.operator) {
            case 'contains': match = name.includes(val); break
            case 'prefix': match = name.startsWith(val); break
            case 'suffix': match = name.endsWith(val); break
          }
          break
        }
        case 'extension': {
          const exts = (filter.value || '').split(',').map(e => e.trim().toLowerCase().replace('.', ''))
          match = exts.includes(file.extension.toLowerCase())
          break
        }
        case 'size': {
          const threshold = parseSize(filter.value || '0', filter.unit || 'MB')
          switch (filter.operator) {
            case '>': match = file.size > threshold; break
            case '<': match = file.size < threshold; break
            case '=': match = Math.abs(file.size - threshold) < 1024; break
          }
          break
        }
        case 'date': {
          const fileDate = new Date(file.modified)
          const now = new Date()
          const val = parseInt(filter.value || '0')
          switch (filter.operator) {
            case 'recent': {
              const diff = parseDuration(val, filter.unit || 'day')
              match = (now.getTime() - fileDate.getTime()) < diff
              break
            }
            case 'before': {
              const diff = parseDuration(val, filter.unit || 'day')
              match = (now.getTime() - fileDate.getTime()) > diff
              break
            }
          }
          break
        }
        case 'empty_dir': {
          match = file.is_dir && file.is_empty
          break
        }
      }

      if (filter.negate) match = !match
      if (!match) return false
    }
    return true
  }

  function parseSize(value: string, unit: string): number {
    const num = parseFloat(value) || 0
    switch (unit) {
      case 'KB': return num * 1024
      case 'MB': return num * 1024 * 1024
      case 'GB': return num * 1024 * 1024 * 1024
      default: return num
    }
  }

  function parseDuration(value: number, unit: string): number {
    const ms = value
    switch (unit) {
      case 'hour': return ms * 3600 * 1000
      case 'day': return ms * 86400 * 1000
      case 'month': return ms * 30 * 86400 * 1000
      default: return ms * 86400 * 1000
    }
  }

  function toggleSelect(path: string) {
    if (selectedPaths.value.has(path)) {
      selectedPaths.value.delete(path)
    } else {
      selectedPaths.value.add(path)
    }
  }

  function selectAll() {
    const allMatched = filteredFiles.value.map(f => f.path)
    if (selectedPaths.value.size === allMatched.length) {
      selectedPaths.value.clear()
    } else {
      selectedPaths.value = new Set(allMatched)
    }
  }

  async function deleteSelected() {
    const paths = Array.from(selectedPaths.value)
    if (paths.length === 0) return

    try {
      const deleted = await invoke<string[]>('delete_files', { paths })
      // Remove deleted from files list
      const deletedSet = new Set(deleted)
      files.value = files.value.filter(f => !deletedSet.has(f.path))
      selectedPaths.value.clear()
    } catch (e) {
      console.error('Delete failed:', e)
    }
  }

  async function dissolvePreview(): Promise<DissolveResult[]> {
    if (!currentPath.value) return []
    try {
      return await invoke<DissolveResult[]>('dissolve_folder', {
        path: currentPath.value,
        keepLevels: keepLevels.value,
        dryRun: true,
      })
    } catch (e) {
      console.error('Dissolve preview failed:', e)
      return []
    }
  }

  async function dissolveExecute(): Promise<DissolveResult[]> {
    if (!currentPath.value) return []
    try {
      const results = await invoke<DissolveResult[]>('dissolve_folder', {
        path: currentPath.value,
        keepLevels: keepLevels.value,
        dryRun: false,
      })
      // Re-scan after dissolve
      await scanFiles(currentPath.value)
      return results
    } catch (e) {
      console.error('Dissolve execute failed:', e)
      return []
    }
  }

  async function loadRules() {
    try {
      rules.value = await invoke<FilterRule[]>('load_rules')
    } catch (e) {
      console.error('Load rules failed:', e)
    }
  }

  async function saveRule(name: string) {
    const rule: FilterRule = {
      id: Date.now().toString(),
      name,
      filters: JSON.parse(JSON.stringify(filters.value)),
      created_at: new Date().toISOString(),
    }
    const prevRules = [...rules.value]
    rules.value.push(rule)
    try {
      await invoke('save_rules', { rules: rules.value })
    } catch (e) {
      console.error('Save rule failed:', e)
      rules.value = prevRules
    }
  }

  async function deleteRule(id: string) {
    rules.value = rules.value.filter(r => r.id !== id)
    try {
      await invoke('save_rules', { rules: rules.value })
    } catch (e) {
      console.error('Delete rule failed:', e)
    }
  }

  function loadRule(rule: FilterRule) {
    filters.value = JSON.parse(JSON.stringify(rule.filters))
    previewMode.value = true
  }

  function setSort(key: 'name' | 'size' | 'modified' | 'extension') {
    if (sortKey.value === key) {
      sortAsc.value = !sortAsc.value
    } else {
      sortKey.value = key
      sortAsc.value = true
    }
  }

  return {
    // State
    files,
    selectedPaths,
    currentPath,
    recursive,
    loading,
    previewMode,
    filters,
    dissolveMode,
    keepLevels,
    rules,
    sortKey,
    sortAsc,
    // Computed
    filteredFiles,
    selectedCount,
    totalCount,
    matchedCount,
    // Methods
    scanFiles,
    toggleSelect,
    selectAll,
    deleteSelected,
    dissolvePreview,
    dissolveExecute,
    loadRules,
    saveRule,
    deleteRule,
    loadRule,
    setSort,
  }
})
