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
