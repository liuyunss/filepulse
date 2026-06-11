export interface FileItem {
  path: string
  name: string
  size: number
  is_dir: boolean
  is_empty: boolean
  modified: string
  extension: string
}

export interface ScanOptions {
  path: string
  recursive: boolean
}

export interface FilterCondition {
  filter_type: 'name' | 'extension' | 'size' | 'date' | 'empty_dir'
  enabled: boolean
  operator?: 'contains' | 'prefix' | 'suffix' | '>' | '<' | '=' | 'recent' | 'before'
  value?: string
  unit?: 'KB' | 'MB' | 'GB' | 'hour' | 'day' | 'month'
  negate: boolean
}

export interface FilterRule {
  id: string
  name: string
  filters: FilterCondition[]
  created_at: string
}

export interface DissolveResult {
  name: string       // relative path from root
  target: string     // target relative path (may differ if renamed)
  action: 'move' | 'skip'  // move=will be moved, skip=duplicate skipped
}

// === Streaming event types ===

export type ScanEvent =
  | { type: 'total'; total: number }
  | { type: 'batch'; items: FileItem[]; processed: number; total: number }
  | { type: 'done'; total_items: number; elapsed_ms: number }
  | { type: 'error'; message: string }

export type DeleteEvent =
  | { type: 'total'; total: number }
  | { type: 'progress'; processed: number; total: number }
  | { type: 'done'; result: { deleted: string[]; failed: string[] }; elapsed_ms: number }
  | { type: 'error'; message: string }

export type DissolveEvent =
  | { type: 'total'; total: number }
  | { type: 'progress'; processed: number; total: number }
  | { type: 'done'; results: DissolveResult[]; elapsed_ms: number }
  | { type: 'error'; message: string }

export type DedupeEvent =
  | { type: 'phase'; phase: string }
  | { type: 'total'; total: number }
  | { type: 'progress'; processed: number; total: number }
  | { type: 'done'; groups: DuplicateGroup[]; elapsed_ms: number }
  | { type: 'delete_done'; deleted: number; elapsed_ms: number }
  | { type: 'error'; message: string }

export interface DuplicateGroup {
  files: { path: string; modified: string }[]
  size: number
}

// === Progress state for status bar ===

export interface ProgressState {
  active: boolean       // is an operation in progress
  operation: string     // 'scan' | 'delete' | 'dissolve' | 'dedupe'
  processed: number     // items processed so far
  total: number         // total items (0 = unknown/indeterminate)
  startTime: number     // timestamp when operation started
  elapsed: string       // formatted elapsed time
  estimated: string     // formatted estimated remaining time
  done: boolean         // operation completed
  fadeOut: boolean      // fade-out animation active
}
