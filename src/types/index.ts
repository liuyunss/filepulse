export interface FileItem {
  path: string
  name: string
  size: number
  is_dir: boolean
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
  original: string
  new_path: string
}
