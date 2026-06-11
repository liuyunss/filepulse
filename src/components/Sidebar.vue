<template>
  <aside class="sidebar">
    <!-- 筛选条件 -->
    <div class="side-section" :class="{ disabled: toolActive }">
      <div class="side-title">
        筛选条件
        <button class="icon-btn add-icon" :disabled="toolActive" @click="showAdd = !showAdd" title="新增条件">＋</button>
        <button class="icon-btn" :class="{ active: filterEdit }" :disabled="toolActive" @click="filterEdit = !filterEdit" title="编辑模式">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h12"/></svg>
        </button>
        <button class="icon-btn clear-btn" :disabled="toolActive || store.filters.length === 0" @click="store.clearFilters()" title="清空所有条件">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6"/></svg>
        </button>
        <button class="icon-btn" :disabled="toolActive" @click="store.resetFilters()" title="重置为默认条件">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
        </button>
      </div>
      <div v-if="showAdd && !toolActive" class="add-panel" @mouseleave="showAdd = false">
        <button v-for="t in filterTypes" :key="t.key" class="type-btn" :style="{ background: colors[t.key] }" @click="addFilter(t.key)">{{ t.label }}</button>
      </div>

      <div class="filter-box" v-if="store.filters.length > 0">
        <div v-for="(f, i) in store.filters" :key="i" class="filter-line" :style="{ borderLeftColor: colors[f.filter_type] }" @mouseenter="hoverIdx = i" @mouseleave="hoverIdx = -1">
          <span class="f-badge" :class="{ hide: filterEdit && hoverIdx === i }" :style="{ background: colors[f.filter_type] }">{{ typeLabel(f.filter_type) }}</span>
          <label class="f-toggle"><input type="checkbox" v-model="f.enabled" :disabled="toolActive" /></label>
          <template v-if="f.filter_type === 'name'">
            <select v-model="f.operator" class="sel" :disabled="toolActive"><option value="contains">包含</option><option value="prefix">前缀</option><option value="suffix">后缀</option></select>
            <input v-model="f.value" class="inp" placeholder="关键词" :disabled="toolActive" />
          </template>
          <template v-if="f.filter_type === 'extension'">
            <select class="sel" @change="applyExtCategory($event, f)" :disabled="toolActive">
              <option value="">分类</option>
              <option v-for="c in extCategories" :key="c.label" :value="c.exts">{{ c.label }}</option>
            </select>
            <input v-model="f.value" class="inp" placeholder=".log,.tmp" :disabled="toolActive" />
          </template>
          <template v-if="f.filter_type === 'size'">
            <select v-model="f.operator" class="sel" :disabled="toolActive"><option value="&gt;">&gt;</option><option value="&lt;">&lt;</option><option value="=">=</option></select>
            <input v-model="f.value" class="inp-s" type="number" min="1" placeholder="10" :disabled="toolActive" />
            <select v-model="f.unit" class="sel" :disabled="toolActive"><option value="KB">KB</option><option value="MB">MB</option><option value="GB">GB</option></select>
          </template>
          <template v-if="f.filter_type === 'date'">
            <select v-model="f.operator" class="sel" :disabled="toolActive"><option value="recent">最近</option><option value="before">早于</option></select>
            <input v-model="f.value" class="inp-xs" type="number" min="1" placeholder="7" :disabled="toolActive" />
            <select v-model="f.unit" class="sel" :disabled="toolActive"><option value="day">天</option><option value="hour">时</option><option value="month">月</option></select>
          </template>
          <label class="negate"><input type="checkbox" v-model="f.negate" :disabled="toolActive" /> 取反</label>
          <button v-show="filterEdit && hoverIdx === i && !toolActive" class="del-btn" @click="store.removeFilter(i)">✕</button>
        </div>
      </div>
      <div v-else class="empty-hint">点击 ＋ 添加筛选规则</div>
    </div>

    <!-- 规则管理 -->
    <div class="side-section" :class="{ disabled: toolActive }">
      <div class="side-title" style="margin-bottom:0">
        规则管理
        <input v-model="ruleName" class="inp rule-inp" placeholder="命名并保存..." :disabled="toolActive" @keyup.enter="handleSave" />
        <button class="icon-btn save-icon" :disabled="saving || !ruleName.trim() || store.filters.length === 0 || toolActive" @click="handleSave" title="保存当前筛选">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        </button>
        <button class="icon-btn" :class="{ active: ruleEdit }" :disabled="toolActive" @click="ruleEdit = !ruleEdit" title="编辑模式">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h12"/></svg>
        </button>
      </div>
      <div class="rule-list" v-if="store.rules.length > 0">
        <div v-for="(r, idx) in store.rules" :key="r.id" class="rule-line" :class="{ editing: ruleEdit }" :title="r.name">
          <span class="r-num">{{ idx + 1 }}</span>
          <span class="r-name">{{ r.name }}</span>
          <span class="r-summary" :title="ruleSummary(r)">{{ ruleSummary(r) }}</span>
          <button class="rule-load-btn" @click.stop="store.loadRule(r)" title="加载此规则">加载</button>
          <button v-show="ruleEdit" class="rule-del-btn" @click.stop="store.deleteRule(r.id)" title="删除">✕</button>
        </div>
      </div>
      <div v-else class="empty-hint">暂无保存的规则</div>
    </div>

    <!-- 工具集合 -->
    <div class="side-section side-tools">
      <div class="side-title">工具集合 <span class="tip-icon" data-tip="工具模式与筛选模式互斥，启用工具时将禁用筛选条件">!</span></div>
      <div class="tool-box">
        <label class="tool-row" style="border-left-color:#ff4d4f">
          <input type="checkbox" v-model="store.deleteEmpty" /><span>删除空文件夹</span>
        </label>
        <label class="tool-row" style="border-left-color:#fa8c16">
          <input type="checkbox" v-model="store.dissolveMode" /><span>解散文件夹</span>
          <span class="tool-txt">保留</span>
          <input v-model.number="store.keepLevels" class="inp-xs" type="number" min="0" style="flex:none;width:44px;" />
          <span class="tool-txt">级目录</span>
          <span class="tip-icon" data-tip="0 级 → a/b/c.txt 变为 /c.txt&#10;1 级 → a/b/c.txt 变为 a/c.txt&#10;2 级 → a/b/c.txt 变为 a/b/c.txt">?</span>
        </label>
        <label class="tool-row" style="border-left-color:#722ed1">
          <input type="checkbox" v-model="store.dedupeMode" /><span>删除重复文件</span>
          <span class="tip-icon" data-tip="检测文件夹内完全相同的文件&#10;支持保留最新或最旧的文件">?</span>
        </label>
        <label class="tool-row" style="border-left-color:#0ea5e9">
          <input type="checkbox" v-model="store.rotateMode" /><span>旋转</span>
          <select v-model="store.rotateDir" class="sel"><option value="cw">顺时针</option><option value="ccw">逆时针</option></select>
          <select v-model="store.rotateAngle" class="sel"><option :value="90">90°</option><option :value="180">180°</option><option :value="270">270°</option></select>
          <span class="tip-icon" data-tip="顺时针90°→图片右转&#10;修改JPEG的EXIF元信息实现">?</span>
        </label>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useFilePulseStore } from '@/stores/filepulse'
import type { FilterCondition, FilterRule } from '@/types'

const store = useFilePulseStore()
const showAdd = ref(false)
const ruleName = ref('')
const hoverIdx = ref(-1)
const filterEdit = ref(false)
const ruleEdit = ref(false)
const saving = ref(false)

const toolActive = computed(() => store.deleteEmpty || store.dissolveMode || store.rotateMode || store.dedupeMode)

const colors: Record<string, string> = { name:'#1890ff', extension:'#52c41a', size:'#fa8c16', date:'#8b5cf6' }
const filterTypes = [
  { key:'name' as const, label:'名称' }, { key:'extension' as const, label:'后缀' },
  { key:'size' as const, label:'大小' }, { key:'date' as const, label:'日期' },
]

function typeLabel(t:string) { const m:Record<string,string>={name:'名称',extension:'后缀',size:'大小',date:'日期'}; return m[t]||t }
const extCategories = [
  { label:'图片', exts:'.jpg,.jpeg,.png,.gif,.bmp,.svg,.webp,.ico' },
  { label:'视频', exts:'.mp4,.avi,.mkv,.mov,.wmv,.flv,.webm' },
  { label:'音频', exts:'.mp3,.wav,.flac,.aac,.ogg,.wma,.m4a' },
  { label:'文档', exts:'.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md' },
  { label:'压缩包', exts:'.zip,.rar,.7z,.tar,.gz,.bz2' },
  { label:'代码', exts:'.js,.ts,.py,.java,.cpp,.rs,.go,.vue,.html,.css' },
  { label:'可执行', exts:'.exe,.msi,.bat,.sh,.apk,.app' },
]

function applyExtCategory(event: Event, filter: FilterCondition) {
  const val = (event.target as HTMLSelectElement).value
  filter.value = val
}

function addFilter(type:FilterCondition['filter_type']) { store.addFilter(type); showAdd.value=false }

function ruleSummary(rule:FilterRule):string {
  const active = rule.filters.filter(f=>f.enabled)
  if(active.length===0) return '无条件'
  return active.map(f=>{
    const l=typeLabel(f.filter_type)
    switch(f.filter_type){
      case'name':return `${l}:${f.operator==='contains'?'含':f.operator==='prefix'?'前':'后'}${f.value}`
      case'extension':return `${l}:${f.value||'*'}`
      case'size':return `${l}${f.operator}${f.value}${f.unit}`
      case'date':return `${l}:${f.operator==='recent'?'近':'早'}${f.value}${f.unit}`
      default:return l
    }
  }).join(' / ')
}

async function handleSave() {
  if (saving.value) return
  const n=ruleName.value.trim()
  if(!n||store.filters.length===0) return
  saving.value = true
  try {
    await store.saveRule(n)
    ruleName.value = ''
  } catch(e) {
    console.error('保存规则失败:', e)
  } finally {
    saving.value = false
  }
}

onMounted(()=>store.loadRules())
</script>

<style scoped>
.sidebar { width:320px; min-width:320px; background:var(--bg-secondary); border-right:1px solid var(--border-color); display:flex; flex-direction:column; overflow:hidden; height:100vh; }
.side-section { padding:10px 14px; border-bottom:1px solid var(--border-color); display:flex; flex-direction:column; overflow:visible; }
.side-section:first-child { flex:1; }
.side-section:nth-child(2) { flex:1; }
.side-tools { flex:1; border-bottom:none; }
.disabled { opacity:.45; pointer-events:none; }
.side-title { font-size:12px; font-weight:600; color:var(--text-primary); margin-bottom:8px; display:flex; align-items:center; gap:5px; }

.icon-btn { border:none; background:none; cursor:pointer; padding:2px 4px; border-radius:4px; display:flex; align-items:center; flex-shrink:0; color:#bbb; transition:all .15s; }
.icon-btn:hover:not(:disabled) { background:#f0f0f0; color:#666; }
.icon-btn.active { color:var(--accent-color); background:#e6f7ff; }
.icon-btn:disabled { opacity:.35; cursor:not-allowed; }
.add-icon { color:var(--accent-color); font-size:18px; font-weight:700; }
.save-icon { color:var(--accent-color); }
.clear-btn:hover:not(:disabled) { color:var(--danger-color); background:#fff1f0; }

.add-panel { display:flex; gap:6px; padding:8px; margin-bottom:8px; border:1px solid var(--border-color); border-radius:6px; background:var(--bg-primary); }
.type-btn { padding:5px 12px; border:none; border-radius:4px; font-size:12px; font-weight:600; color:#fff; cursor:pointer; }
.type-btn:hover { opacity:.85; }

.filter-box { display:flex; flex-direction:column; gap:3px; overflow-y:auto; flex:1; min-height:0; }
.filter-line { display:flex; align-items:center; gap:5px; padding:5px 8px; border:1px solid var(--border-color); border-radius:4px; border-left:3px solid transparent; background:#fff; height:32px; position:relative; }
.f-badge { font-size:11px; font-weight:600; padding:3px 8px; border-radius:3px; color:#fff; white-space:nowrap; flex-shrink:0; transition:opacity .12s,width .12s,padding .12s,margin .12s; overflow:hidden; }
.f-badge.hide { opacity:0; width:0; padding:3px 0; margin:0; min-width:0; }
.f-toggle { display:flex; flex-shrink:0; }
.f-toggle input { accent-color:var(--accent-color); width:14px; height:14px; }

.sel { padding:3px 5px; border:1px solid #e8e8e8; border-radius:3px; font-size:12px; background:#fafafa; height:26px; flex-shrink:0; color:#333; outline:none; }
.inp { width:100%; padding:3px 8px; border:1px solid #e8e8e8; border-radius:3px; font-size:12px; height:26px; background:#fafafa; color:#333; outline:none; }
.inp:focus { border-color:var(--accent-color); background:#fff; }
.inp-s { flex:1; min-width:40px; padding:3px 4px; border:1px solid #e8e8e8; border-radius:3px; font-size:12px; height:26px; background:#fafafa; color:#333; outline:none; }
.inp-s:focus { border-color:var(--accent-color); background:#fff; }
.inp-xs { flex:1; min-width:32px; padding:3px 4px; border:1px solid #e8e8e8; border-radius:3px; font-size:12px; height:26px; background:#fafafa; color:#333; outline:none; }
.inp-xs:focus { border-color:var(--accent-color); background:#fff; }

.spacer { flex:1; min-width:0; } /* unused, kept for compatibility */
.negate { display:flex; align-items:center; gap:3px; font-size:11px; color:#bbb; cursor:pointer; white-space:nowrap; flex-shrink:0; margin-left:auto; padding-right:2px; }
.negate input { accent-color:#bbb; width:12px; height:12px; }
.del-btn { border:none; background:transparent; color:#ccc; cursor:pointer; font-size:14px; padding:2px 4px; flex-shrink:0; }
.del-btn:hover { color:var(--danger-color); }
.empty-hint { font-size:13px; color:var(--text-muted); text-align:center; padding:16px 0; }

/* 规则 */
.rule-list { display:flex; flex-direction:column; gap:3px; overflow-y:auto; margin-top:8px; flex:1; min-height:0; }
.rule-line { display:flex; align-items:center; gap:6px; padding:4px 8px; border:1px solid var(--border-color); border-radius:4px; background:#fff; border-left:3px solid #0ea5e9; height:32px; }
.rule-line:hover { background:#fafcff; }
.r-num { font-size:11px; font-weight:700; padding:2px 7px; border-radius:3px; background:#e0f2fe; color:#0ea5e9; flex-shrink:0; transition:opacity .12s,width .12s,padding .12s,margin .12s; overflow:hidden; white-space:nowrap; }
.rule-line.editing:hover .r-num { opacity:0; width:0; padding:2px 0; margin:0; min-width:0; }
.r-name { font-size:13px; font-weight:500; white-space:nowrap; flex-shrink:0; }
.r-summary { font-size:11px; color:#999; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0; }
.rule-load-btn { border:1px solid #0ea5e9; border-radius:3px; background:transparent; color:#0ea5e9; font-size:11px; cursor:pointer; padding:2px 8px; flex-shrink:0; }
.rule-load-btn:hover { background:#0ea5e9; color:#fff; }
.rule-del-btn { border:none; background:transparent; color:#ccc; cursor:pointer; font-size:14px; padding:2px 4px; flex-shrink:0; }
.rule-del-btn:hover { color:var(--danger-color); }
.rule-inp { flex:1; min-width:0; height:30px; }

/* 工具 */
.tool-box { display:flex; flex-direction:column; gap:3px; }
.tool-row { display:flex; align-items:center; gap:6px; padding:0 10px; height:38px; border:1px solid var(--border-color); border-radius:4px; border-left:3px solid transparent; background:#fff; font-size:13px; cursor:pointer; }
.tool-row input[type="checkbox"] { accent-color:var(--accent-color); }
.tool-txt { font-size:13px; color:var(--text-muted); }

.tip-icon { display:inline-flex; align-items:center; justify-content:center; width:17px; height:17px; border-radius:50%; background:#e8e8e8; color:#999; font-size:10px; font-weight:700; cursor:help; flex-shrink:0; position:relative; }
.tip-icon:hover::after { content:attr(data-tip); position:absolute; bottom:calc(100% + 8px); left:50%; transform:translateX(-50%); background:#333; color:#fff; padding:8px 12px; border-radius:6px; font-size:12px; font-weight:400; white-space:pre-line; z-index:9999; pointer-events:none; min-width:200px; max-width:280px; box-shadow:0 2px 8px rgba(0,0,0,.15); }
</style>
