import { defineStore } from 'pinia'
import { ref, shallowRef, computed } from 'vue'
import type { FileItem, FilterCondition, FilterRule, DissolveResult } from '@/types'

interface RotatePreview {
  path: string
  original_orientation: number
  new_orientation: number
  description: string
}
import { invoke } from '@tauri-apps/api/core'

export const useFilePulseStore = defineStore('filepulse', () => {
  // State
  // shallowRef: avoids deep Vue Proxy wrapping for each file item (~10-100x faster for large arrays)
  const files = shallowRef<FileItem[]>([])
  const selectedPaths = ref<Set<string>>(new Set())
  const currentPath = ref('')
  const recursive = ref(true)
  const loading = ref(false)
  const previewMode = ref(false)

  // Dynamic filters (pre-populated with 4 defaults)
  const filters = ref<FilterCondition[]>([
    { filter_type: 'name', enabled: false, operator: 'contains', value: '', negate: false },
    { filter_type: 'extension', enabled: false, value: '', negate: false },
    { filter_type: 'size', enabled: false, operator: '>', value: '', unit: 'MB', negate: false },
    { filter_type: 'date', enabled: false, operator: 'recent', value: '', unit: 'day', negate: false },
  ])

  // Dissolve
  const dissolveMode = ref(false)
  const keepLevels = ref(1)

  // Tools
  const deleteEmpty = ref(false)
  const rotateMode = ref(false)
  const rotateAngle = ref(90)
  const rotateDir = ref<'cw' | 'ccw'>('cw')

  // Dedupe
  const dedupeMode = ref(false)

  // Rules
  const rules = ref<FilterRule[]>([])

  // Sort
  const sortKey = ref<'name' | 'size' | 'modified' | 'extension'>('name')
  const sortAsc = ref(true)

  // Computed
  const filteredFiles = computed(() => {
    let result = files.value.filter(f => !f.is_dir)
    if (previewMode.value) result = result.filter(file => matchesFilters(file))
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

  // Filter management
  function addFilter(type: FilterCondition['filter_type']) {
    const base: FilterCondition = { filter_type: type, enabled: true, negate: false }
    switch (type) {
      case 'name':
        filters.value.push({ ...base, operator: 'contains', value: '' })
        break
      case 'extension':
        filters.value.push({ ...base, value: '' })
        break
      case 'size':
        filters.value.push({ ...base, operator: '>', value: '', unit: 'MB' })
        break
      case 'date':
        filters.value.push({ ...base, operator: 'recent', value: '', unit: 'day' })
        break
      case 'empty_dir':
        filters.value.push({ ...base })
        break
    }
  }

  function removeFilter(index: number) {
    filters.value.splice(index, 1)
  }

  function clearFilters() {
    filters.value = []
    previewMode.value = false
  }

  function resetFilters() {
    filters.value = [
      { filter_type: 'name', enabled: false, operator: 'contains', value: '', negate: false },
      { filter_type: 'extension', enabled: false, value: '', negate: false },
      { filter_type: 'size', enabled: false, operator: '>', value: '', unit: 'MB', negate: false },
      { filter_type: 'date', enabled: false, operator: 'recent', value: '', unit: 'day', negate: false },
    ]
    previewMode.value = false
  }

  // Methods
  async function scanFiles(path: string) {
    loading.value = true
    currentPath.value = path
    try {
      console.time('scan')
      const result = await invoke<FileItem[]>('scan_files', { options: { path, recursive: recursive.value } })
      console.timeEnd('scan')
      console.log('Files count:', result.length)
      files.value = result
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
          const val = (filter.value || '').toLowerCase()
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
          if (!filter.value || filter.value === '0' || filter.value === 0) { match = false; break }
          const threshold = parseSize(String(filter.value || '0'), filter.unit || 'MB')
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

  async function deleteSelected(): Promise<number> {
    const paths = Array.from(selectedPaths.value)
    if (paths.length === 0) return 0
    try {
      const result = await invoke<{ deleted: string[]; failed: string[] }>('delete_files', { paths })
      const deletedSet = new Set(result.deleted)
      files.value = files.value.filter(f => !deletedSet.has(f.path))
      selectedPaths.value.clear()
      return result.deleted.length
    } catch (e) {
      console.error('Delete failed:', e)
      return 0
    }
  }

  async function dissolvePreview(): Promise<DissolveResult[]> {
    if (!currentPath.value) return []
    try {
      return await invoke<DissolveResult[]>('dissolve_folder', {
        path: currentPath.value, keepLevels: keepLevels.value, dryRun: true,
      })
    } catch (e) { console.error('Dissolve preview failed:', e); return [] }
  }

  async function dissolveExecute(): Promise<DissolveResult[]> {
    if (!currentPath.value) return []
    try {
      const results = await invoke<DissolveResult[]>('dissolve_folder', {
        path: currentPath.value, keepLevels: keepLevels.value, dryRun: false,
      })
      await scanFiles(currentPath.value)
      return results
    } catch (e) { console.error('Dissolve execute failed:', e); return [] }
  }

  async function deleteEmptyDirs(): Promise<{ deleted: string[]; failed: string[] }> {
    if (!currentPath.value) return { deleted: [], failed: [] }
    try {
      const result = await invoke<{ deleted: string[]; failed: string[] }>('delete_empty_dirs', {
        root: currentPath.value, dryRun: false,
      })
      await scanFiles(currentPath.value)
      return result
    } catch (e) { console.error('Delete empty dirs failed:', e); return { deleted: [], failed: [] } }
  }

  async function previewRotate(): Promise<{ path: string; before: string; after: string }[]> {
    const paths = Array.from(selectedPaths.value).filter(p => /\.(jpe?g|mp4|mov)$/i.test(p))
    if (paths.length === 0) return []
    const results: { path: string; before: string; after: string }[] = []
    for (const path of paths) {
      try {
        const r = await invoke<RotatePreview>('preview_rotate', { path, angle: rotateAngle.value, direction: rotateDir.value })
        results.push({ path, before: orientationName(r.original_orientation), after: orientationName(r.new_orientation) })
      } catch (e) { console.error('Rotate preview failed:', path, e) }
    }
    return results
  }

  async function rotateSelectedFiles() {
    const paths = Array.from(selectedPaths.value).filter(p => /\.(jpe?g|mp4|mov)$/i.test(p))
    if (paths.length === 0) return
    for (const path of paths) {
      try {
        await invoke('rotate_file', { path, angle: rotateAngle.value, direction: rotateDir.value })
      } catch (e) { console.error('Rotate failed:', path, e) }
    }
  }

  function orientationName(v: number): string {
    const m: Record<number, string> = { 1:'正常', 2:'水平翻转', 3:'180°', 4:'垂直翻转', 5:'顺时针90°+翻转', 6:'顺时针90°', 7:'逆时针90°+翻转', 8:'逆时针90°' }
    return m[v] || `未知(${v})`
  }

  interface DupGroup { files: { path: string; modified: string }[]; size: number }

  async function findDuplicates(): Promise<DupGroup[]> {
    if (!currentPath.value) return []
    try { return await invoke<DupGroup[]>('find_duplicates', { root: currentPath.value }) }
    catch (e) { console.error('Find duplicates failed:', e); return [] }
  }

  async function deleteDuplicates(deletePaths: string[]): Promise<number> {
    try {
      await invoke<string[]>('delete_duplicates', { action: { deletePaths } })
      await scanFiles(currentPath.value)
      return deletePaths.length
    } catch (e) { console.error('Delete duplicates failed:', e); return 0 }
  }

  async function loadRules() {
    try { rules.value = await invoke<FilterRule[]>('load_rules') }
    catch (e) { console.error('Load rules failed:', e) }
  }

  async function saveRule(name: string) {
    const rule: FilterRule = {
      id: Date.now().toString(),
      name,
      filters: JSON.parse(JSON.stringify(filters.value)),
      created_at: new Date().toISOString(),
    }
    const prev = [...rules.value]
    rules.value.push(rule)
    try { await invoke('save_rules', { rules: rules.value }) }
    catch (e) { console.error('Save rule failed:', e); rules.value = prev }
  }

  async function deleteRule(id: string) {
    rules.value = rules.value.filter(r => r.id !== id)
    try { await invoke('save_rules', { rules: rules.value }) }
    catch (e) { console.error('Delete rule failed:', e) }
  }

  function loadRule(rule: FilterRule) {
    filters.value = JSON.parse(JSON.stringify(rule.filters))
    previewMode.value = true
  }

  function setSort(key: 'name' | 'size' | 'modified' | 'extension') {
    if (sortKey.value === key) { sortAsc.value = !sortAsc.value }
    else { sortKey.value = key; sortAsc.value = true }
  }

  return {
    files, selectedPaths, currentPath, recursive, loading, previewMode,
    filters, dissolveMode, keepLevels, deleteEmpty, rotateMode, rotateAngle, rotateDir, dedupeMode,
    rules, sortKey, sortAsc,
    filteredFiles, selectedCount, totalCount, matchedCount,
    scanFiles, toggleSelect, selectAll, deleteSelected,
    dissolvePreview, dissolveExecute, deleteEmptyDirs, previewRotate, rotateSelectedFiles,
    findDuplicates, deleteDuplicates,
    loadRules, saveRule, deleteRule, loadRule,
    addFilter, removeFilter, clearFilters, resetFilters, setSort,
  }
})
