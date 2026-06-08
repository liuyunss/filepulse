# 代码审查循环状态

- phase: fix
- round: 4
- max_rounds: 5
- project: /opt/data/projects/filepulse
- branch: dev
- issues:
  - "[file_delete.rs:22-27] trash失败静默吞没: 用户看到\"已删除 X 个项目\"但部分文件实际上没有被删除，没有任何反馈。修复建议：收集失败路径并返回给前端，或在返回的 deleted 列表中区分成功/失败。"
  - "[lib.rs:23] expect() 导致生产环境panic: run(tauri::generate_context!()).expect(...) 在 Tauri 启动失败时直接崩溃，无错误恢复。修复建议：替换为 if let Err(e) = ... { eprintln!(...); } 或使用 log::error!()。"
  - "[FileTable.vue:190] 删除成功消息计数错误: message.success('已删除 ${count} 个项目') 使用删除前的选中数量，而非实际删除成功的数量。修复建议：使用 store.deleteSelected() 的返回值来获取实际删除数量，或在 store 中维护实际删除计数。"
- result: ""
- updated_at: "2026-06-08T17:58:00Z"

---

## Round 4 审查报告 (审查员老B)

### 🔴 必须修复

1. **[file_delete.rs:22-27] trash失败静默吞没** → 用户看到"已删除 X 个项目"但部分文件实际上没有被删除，没有任何反馈。
   - **修复建议**：收集失败路径并返回给前端，或在返回的 `deleted` 列表中区分成功/失败。

2. **[lib.rs:23] `expect()` 导致生产环境panic** → `run(tauri::generate_context!()).expect(...)` 在 Tauri 启动失败时直接崩溃，无错误恢复。
   - **修复建议**：替换为 `if let Err(e) = ... { eprintln!(...); }` 或使用 `log::error!()`。

3. **[FileTable.vue:190] 删除成功消息计数错误** → `message.success('已删除 ${count} 个项目')` 使用删除前的选中数量，而非实际删除成功的数量。如果部分文件删除失败，消息会误导用户。
   - **修复建议**：使用 `store.deleteSelected()` 的返回值来获取实际删除数量，或在 store 中维护实际删除计数。

### 🟡 建议优化

1. **[Sidebar.vue:69] 未使用的导入** → `confirm` 从 `@tauri-apps/plugin-dialog` 导入但未在组件中使用，增加打包体积。
   - **建议**：移除未使用的 `confirm` 导入。

2. **[rule_store.rs:45-46] 非原子文件写入** → `save_rules` 直接覆盖写入 `rules.json`，进程崩溃时可能导致文件损坏。
   - **建议**：先写入临时文件再 `rename` 覆盖，或使用 `tauri-plugin-store` 提供的原子写入。

3. **[file_dissolve.rs:79-82] clean_empty_dirs 递归冗余** → 每个目录递归后都调用 `clean_empty_dirs`，对于深层嵌套目录会重复清理已清空的子目录。
   - **建议**：仅在最顶层目录调用一次清理，或在 `collect_files` 返回后统一清理。

4. **[stores/filepulse.ts:250-257] deleteRule 乐观更新无回滚** → 先修改 UI 再调用 API，API 失败时仅 console.error，规则在 UI 中消失但后端仍存在。
   - **建议**：先调用 API，成功后再更新 UI；或失败时重新 `loadRules()`。

5. **[file_scan.rs:32] follow_links(true) 潜在循环** → 跟随符号链接在存在循环链接时可能触发无限遍历（walkdir 有保护但仍有性能开销）。
   - **建议**：考虑默认不跟随链接，或添加用户可控选项。

### 评分：7.5/10

**优点**：
- 类型定义在 Rust/TS 两端完全一致，Tauri IPC 类型安全
- Pinia store 结构清晰，computed 派生合理
- 系统路径保护（file_delete）是良好的安全实践
- 文件夹解散功能有 dry-run 预览，UX 考虑周到
- Naive UI 主题配置统一，组件风格一致

**不足**：
- 3 个必须修复的问题影响用户信任（静默失败 + 错误计数）和应用稳定性（panic）
- 5 个优化建议涉及健壮性和代码质量

### 结论：需要修改
