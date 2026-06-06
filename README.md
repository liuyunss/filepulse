# FilePulse（文件脉搏）

跨平台桌面文件分析筛选工具，基于 Flutter + `dart:io` 直读本地文件。

## 功能

| 模块 | 能力 |
|------|------|
| 📁 文件夹扫描 | 拖入/浏览文件夹，递归扫描所有子目录 |
| 🔍 多维筛选 | 名称（包含/前缀/后缀+取反）、大小（>/</=+取反）、后缀（+取反）、修改日期（+取反） |
| 📋 文件列表 | 路径、大小、类型（彩色标签）、修改时间，支持排序 |
| ☑️ 批量操作 | 全选/单选 → 批量删除 |
| 🗑️ 空文件夹 | 工具模式，扫描并一键删除空目录 |
| 📂 解散文件夹 | 保留 N 级目录后拍平，预览→确认，自动处理同名冲突 + 清理空目录 |
| 💾 配置保存 | 筛选条件保存/加载，同名覆盖，最多 5 条，持久化到本地 |

## 技术栈

- **Flutter** (Material Design 3) — 跨平台桌面 UI
- **`dart:io`** — 直接文件系统操作（无服务端）
- **`provider`** — 状态管理
- **`shared_preferences`** — 配置持久化
- 目标平台：**Windows / macOS / Linux**

## 项目结构

```
lib/
  main.dart              # 入口
  models/
    file_item.dart       # 文件数据模型
    filter_rule.dart     # 筛选规则模型
  services/
    file_service.dart    # 核心业务逻辑
  widgets/
    app.dart             # 全部 UI（侧栏筛选 + 文件列表 + 工具）
```

## 开发

```bash
# 安装依赖
flutter pub get

# 运行 Windows（调试）
flutter run -d windows

# 运行 Linux
flutter run -d linux

# 运行 macOS
flutter run -d macos
```

## 构建

```bash
# Windows (.exe)
flutter build windows --release

# macOS (.app → .dmg)
flutter build macos --release

# Linux (bundle)
flutter build linux --release
```

## CI/CD

使用 GitHub Actions，推送 `v*` 标签时自动构建 Windows/macOS/Linux 三平台并发布 Release。

工作流文件：`.github/workflows/build.yml`
