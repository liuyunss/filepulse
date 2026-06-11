import { defineStore } from 'pinia'
import { ref, shallowRef, computed } from 'vue'
import type { FileItem, FilterCondition, FilterRule, DissolveResult, ProgressState } from '@/types'
import { invoke, Channel } from '@tauri-apps/api/core'

interface RotatePreview {
  path: string
  original_orientation: number
  new_orientation: number
  description: string
}

export const useFilePulseStore = defineStore('filepulse', () => {
  // ─── State ───────────────────────────────────────
  // shallowRef: avoids deep Vue Proxy wrapping for each file item (~10-100x faster for large arrays)
  const files = shallowRef<FileItem[]>([])
  const selectedPaths = ref<Set<string>>(new Set())
  const currentPath = ref('')
  const recursive = ref(true)
  const previewMode = ref(false)

  // Streaming progress state
  const progress = ref<ProgressState>({
    active: false,
    operation: '',
    processed: 0,
    total: 0,
    startTime: 0,
    elapsed: '00:00',
    estimated: '',
    done: false,
    fadeOut: false,
  })

  // Scan-specific: plain (non-reactive) accumulator to avoid O(n²) spread on each batch
  let scanBatchItems: FileItem[] = []

  // Dynamic filters (pre-populated with 4 defaults)
  const filters = ref<FilterCondition[]>([
    { filter_type: 'name', enabled: false, operator: 'contains', value: '', negate: false },
    { filter_type: 'extension', enabled: false, value: '', negate: false },
    { filter_type: 'size', enabled: false, operator: '>', value: '10', unit: 'MB', negate: false },
    { filter_type: 'date', enabled: false, operator: 'recent', value: '7', unit: 'day', negate: false },
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

  // ─── Computed ────────────────────────────────────
  // Quick sort-only list (no filter overhead when previewMode is off)
  const sortedOnly = computed(() => {
    const result = files.value.filter(f => !f.is_dir)
    return [...result].sort((a, b) => {
      let cmp = 0
      switch (sortKey.value) {
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'size': cmp = a.size - b.size; break
        case 'modified': cmp = a.modified.localeCompare(b.modified); break
        case 'extension': cmp = a.extension.localeCompare(b.extension); break
      }
      return sortAsc.value ? cmp : -cmp
    })
  })

  const filteredFiles = computed(() => {
    if (!previewMode.value) return sortedOnly.value
    return sortedOnly.value.filter(file => matchesFilters(file))
  })

  const selectedCount = computed(() => selectedPaths.value.size)
  const totalCount = computed(() => files.value.length)
  const matchedCount = computed(() => {
    if (!previewMode.value) return 0
    return files.value.filter(f => matchesFilters(f)).length
  })

  // ─── Progress helpers ────────────────────────────
  let progressTimer: ReturnType<typeof setInterval> | null = null
  let minDisplayTimer: ReturnType<typeof setTimeout> | null = null

  function formatTime(ms: number): string {
    const totalSec = Math.floor(ms / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  function startProgress(operation: string, total: number = 0) {
    if (minDisplayTimer) { clearTimeout(minDisplayTimer); minDisplayTimer = null }
    progress.value = {
      active: true,
      operation,
      processed: 0,
      total,
      startTime: Date.now(),
      elapsed: '00:00',
      estimated: '',
      done: false,
      fadeOut: false,
    }
    if (progressTimer) clearInterval(progressTimer)
    progressTimer = setInterval(() => {
      if (!progress.value.active) return
      const elapsedMs = Date.now() - progress.value.startTime
      progress.value.elapsed = formatTime(elapsedMs)

      if (progress.value.total > 0 && progress.value.processed > 0) {
        const rate = progress.value.processed / elapsedMs
        const remaining = (progress.value.total - progress.value.processed) / rate
        progress.value.estimated = formatTime(remaining)
      }
    }, 1000)
  }

  function updateProgress(processed: number, total: number) {
    progress.value.processed = processed
    progress.value.total = total
  }

  function finishProgress() {
    if (progressTimer) {
      clearInterval(progressTimer)
      progressTimer = null
    }
    progress.value.done = true
    // Ensure minimum display time: keep visible for at least 800ms from operation start
    const elapsed = Date.now() - progress.value.startTime
    const remaining = Math.max(0, 800 - elapsed)
    if (minDisplayTimer) clearTimeout(minDisplayTimer)
    minDisplayTimer = setTimeout(() => {
      progress.value.fadeOut = true
      setTimeout(() => {
        progress.value.active = false
        progress.value.fadeOut = false
      }, 300)
    }, remaining)
  }

  // ─── Streaming: Scan ─────────────────────────────
  async function scanFiles(path: string) {
    currentPath.value = path
    scanBatchItems = []
    files.value = [] // clear old files immediately so UI shows scan progress
    startProgress('scan')

    try {
      console.time('scan')
      const channel = new Channel()

      channel.onmessage = (event: any) => {
        try {
          switch (event.type) {
            case 'total':
              updateProgress(0, event.total)
              break
            case 'batch':
              // Append batch to plain accumulator (no O(n²) spread)
              scanBatchItems.push(...event.items)
              updateProgress(event.processed, event.total)
              break
            case 'done':
              files.value = scanBatchItems
              selectedPaths.value.clear()
              console.timeEnd('scan')
              console.log('Files count:', event.total_items, `(${event.elapsed_ms}ms)`)
              finishProgress()
              break
            case 'error':
              console.error('Scan error:', event.message)
              files.value = []
              finishProgress()
              break
          }
        } catch (e) {
          console.error('Scan channel callback error:', e)
          finishProgress()
        }
      }

      await invoke('scan_files_streaming', {
        options: { path, recursive: recursive.value },
        onProgress: channel,
      })
    } catch (e) {
      console.error('Scan failed:', e)
      files.value = []
      finishProgress()
    }
  }

  // ─── Streaming: Delete ───────────────────────────
  async function deleteSelected(): Promise<number> {
    const paths = Array.from(selectedPaths.value)
    if (paths.length === 0) return 0

    startProgress('delete', paths.length)

    try {
      const channel = new Channel()
      let deletedPaths: string[] = []

      channel.onmessage = (event: any) => {
        try {
          switch (event.type) {
            case 'total':
              updateProgress(0, event.total)
              break
            case 'progress':
              updateProgress(event.processed, event.total)
              break
            case 'done':
              deletedPaths = event.result.deleted
              // Update file list by removing deleted paths
              const deletedSet = new Set(deletedPaths)
              files.value = files.value.filter(f => !deletedSet.has(f.path))
              selectedPaths.value.clear()
              finishProgress()
              break
            case 'error':
              console.error('Delete error:', event.message)
              finishProgress()
              break
          }
        } catch (e) {
          console.error('Delete channel callback error:', e)
          finishProgress()
        }
      }

      await invoke('delete_files_streaming', { paths, onProgress: channel })
      return deletedPaths.length
    } catch (e) {
      console.error('Delete failed:', e)
      finishProgress()
      return 0
    }
  }

  // ─── Streaming: Delete Empty Dirs ────────────────
  async function deleteEmptyDirs(): Promise<{ deleted: string[]; failed: string[] }> {
    if (!currentPath.value) return { deleted: [], failed: [] }

    startProgress('delete')

    try {
      const channel = new Channel()
      let result = { deleted: [] as string[], failed: [] as string[] }

      channel.onmessage = (event: any) => {
        try {
          switch (event.type) {
            case 'total':
              updateProgress(0, event.total)
              break
            case 'progress':
              updateProgress(event.processed, event.total)
              break
            case 'done':
              result = event.result
              finishProgress()
              break
            case 'error':
              console.error('Delete empty dirs error:', event.message)
              finishProgress()
              break
          }
        } catch (e) {
          console.error('Delete empty dirs channel callback error:', e)
          finishProgress()
        }
      }

      await invoke('delete_empty_dirs_streaming', {
        root: currentPath.value, dryRun: false, onProgress: channel,
      })

      if (result.deleted.length > 0 || result.failed.length > 0) {
        await scanFiles(currentPath.value)
      }
      return result
    } catch (e) {
      console.error('Delete empty dirs failed:', e)
      finishProgress()
      return { deleted: [], failed: [] }
    }
  }

  // ─── Streaming: Dissolve ─────────────────────────
  async function dissolvePreview(): Promise<DissolveResult[]> {
    if (!currentPath.value) return []
    startProgress('dissolve')
    try {
      const results = await invoke<DissolveResult[]>('dissolve_folder', {
        path: currentPath.value, keepLevels: keepLevels.value, dryRun: true,
      })
      finishProgress()
      return results
    } catch (e) {
      console.error('Dissolve preview failed:', e)
      finishProgress()
      return []
    }
  }

  async function dissolveExecute(): Promise<DissolveResult[]> {
    if (!currentPath.value) return []

    startProgress('dissolve')

    try {
      const channel = new Channel()
      let results: DissolveResult[] = []

      channel.onmessage = (event: any) => {
        try {
          switch (event.type) {
            case 'total':
              updateProgress(0, event.total)
              break
            case 'progress':
              updateProgress(event.processed, event.total)
              break
            case 'done':
              results = event.results
              finishProgress()
              break
            case 'error':
              console.error('Dissolve error:', event.message)
              finishProgress()
              break
          }
        } catch (e) {
          console.error('Dissolve channel callback error:', e)
          finishProgress()
        }
      }

      await invoke('dissolve_folder_streaming', {
        path: currentPath.value, keepLevels: keepLevels.value, dryRun: false, onProgress: channel,
      })

      await scanFiles(currentPath.value)
      return results
    } catch (e) {
      console.error('Dissolve execute failed:', e)
      finishProgress()
      return []
    }
  }

  // ─── Streaming: Dedupe ──────────────────────────
  interface DupGroup { files: { path: string; modified: string }[]; size: number }

  async function findDuplicates(): Promise<DupGroup[]> {
    if (!currentPath.value) return []

    startProgress('dedupe')

    try {
      const channel = new Channel()
      let groups: DupGroup[] = []

      channel.onmessage = (event: any) => {
        try {
          switch (event.type) {
            case 'phase':
              // Could show phase name in progress if needed
              break
            case 'total':
              updateProgress(0, event.total)
              break
            case 'progress':
              updateProgress(event.processed, event.total)
              break
            case 'done':
              groups = event.groups
              finishProgress()
              break
            case 'error':
              console.error('Dedupe error:', event.message)
              finishProgress()
              break
          }
        } catch (e) {
          console.error('Dedupe channel callback error:', e)
          finishProgress()
        }
      }

      await invoke('find_duplicates_streaming', { root: currentPath.value, onProgress: channel })
      return groups
    } catch (e) {
      console.error('Find duplicates failed:', e)
      finishProgress()
      return []
    }
  }

  async function deleteDuplicates(deletePaths: string[]): Promise<number> {
    if (deletePaths.length === 0) return 0

    startProgress('dedupe', deletePaths.length)

    try {
      const channel = new Channel()
      let deletedCount = 0

      channel.onmessage = (event: any) => {
        try {
          switch (event.type) {
            case 'total':
              updateProgress(0, event.total)
              break
            case 'progress':
              updateProgress(event.processed, event.total)
              break
            case 'delete_done':
              deletedCount = event.deleted
              finishProgress()
              break
            case 'error':
              console.error('Delete duplicates error:', event.message)
              finishProgress()
              break
          }
        } catch (e) {
          console.error('Delete duplicates channel callback error:', e)
          finishProgress()
        }
      }

      await invoke('delete_duplicates_streaming', {
        action: { deletePaths }, onProgress: channel,
      })

      await scanFiles(currentPath.value)
      return deletedCount
    } catch (e) {
      console.error('Delete duplicates failed:', e)
      finishProgress()
      return 0
    }
  }

  // ─── Filter management ───────────────────────────
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
        filters.value.push({ ...base, operator: '>', value: '10', unit: 'MB' })
        break
      case 'date':
        filters.value.push({ ...base, operator: 'recent', value: '7', unit: 'day' })
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
      { filter_type: 'size', enabled: false, operator: '>', value: '10', unit: 'MB', negate: false },
      { filter_type: 'date', enabled: false, operator: 'recent', value: '7', unit: 'day', negate: false },
    ]
    previewMode.value = false
  }

  // ─── Matching logic ──────────────────────────────
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

  // ─── Selection ───────────────────────────────────
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

  // ─── Rotate (unchanged, uses invoke directly) ───
  async function previewRotate(): Promise<{ path: string; before: string; after: string }[]> {
    const paths = Array.from(selectedPaths.value).filter(p => /\.(jpe?g|mp4|mov)$/i.test(p))
    if (paths.length === 0) return []
    startProgress('rotate', paths.length)
    const results: { path: string; before: string; after: string }[] = []
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i]
      try {
        const r = await invoke<RotatePreview>('preview_rotate', { path, angle: rotateAngle.value, direction: rotateDir.value })
        results.push({ path, before: orientationName(r.original_orientation), after: orientationName(r.new_orientation) })
      } catch (e) { console.error('Rotate preview failed:', path, e) }
      updateProgress(i + 1, paths.length)
    }
    finishProgress()
    return results
  }

  async function rotateSelectedFiles() {
    const paths = Array.from(selectedPaths.value).filter(p => /\.(jpe?g|mp4|mov)$/i.test(p))
    if (paths.length === 0) return
    startProgress('rotate', paths.length)
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i]
      try {
        await invoke('rotate_file', { path, angle: rotateAngle.value, direction: rotateDir.value })
      } catch (e) { console.error('Rotate failed:', path, e) }
      updateProgress(i + 1, paths.length)
    }
    finishProgress()
  }

  function orientationName(v: number): string {
    const m: Record<number, string> = { 1:'正常', 2:'水平翻转', 3:'180°', 4:'垂直翻转', 5:'顺时针90°+翻转', 6:'顺时针90°', 7:'逆时针90°+翻转', 8:'逆时针90°' }
    return m[v] || `未知(${v})`
  }

  // ─── Rules ───────────────────────────────────────
  let saveRuleLock = false

  async function loadRules() {
    try { rules.value = await invoke<FilterRule[]>('load_rules') }
    catch (e) { console.error('Load rules failed:', e) }
  }

  async function saveRule(name: string) {
    if (saveRuleLock) { console.warn('saveRule already in progress, skipping'); return }
    saveRuleLock = true
    try {
      // Deep clone and coerce all values to strings to match Rust's Option<String>
      const cloned = filters.value.map(f => ({
        ...f,
        value: f.value != null ? String(f.value) : undefined,
        operator: f.operator ?? undefined,
        unit: f.unit ?? undefined,
      }))
      const rule: FilterRule = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name,
        filters: cloned,
        created_at: new Date().toISOString(),
      }
      console.log('Saving rule:', JSON.stringify(rule))
      const prev = [...rules.value]
      rules.value = [...rules.value, rule]
      try { await invoke('save_rules', { rules: rules.value }) }
      catch (e) { console.error('Save rule failed:', e); rules.value = prev; throw e }
    } finally {
      saveRuleLock = false
    }
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
    files, selectedPaths, currentPath, recursive, previewMode,
    filters, dissolveMode, keepLevels, deleteEmpty, rotateMode, rotateAngle, rotateDir, dedupeMode,
    rules, sortKey, sortAsc, progress,
    filteredFiles, selectedCount, totalCount, matchedCount,
    scanFiles, toggleSelect, selectAll, deleteSelected,
    dissolvePreview, dissolveExecute, deleteEmptyDirs, previewRotate, rotateSelectedFiles,
    findDuplicates, deleteDuplicates,
    loadRules, saveRule, deleteRule, loadRule,
    addFilter, removeFilter, clearFilters, resetFilters, setSort,
  }
})
