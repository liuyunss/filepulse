# 文件脉搏（FilePulse）

跨平台文件分析筛选工具

## 功能

- 📁 文件夹路径输入扫描（递归扫描所有子文件夹）
- 🔍 多维度筛选：名称（包含/前缀/后缀+取反）、大小（大于/小于/等于+取反）、后缀（+取反）、修改日期（+取反）、空文件夹（+取反）
- 📋 文件列表展示（文件名、大小、类型、修改时间、路径）
- ☑️ 全选/反选
- 🗑️ 批量删除选中文件
- 🔄 重复文件检测（按文件名+大小分组）
- 📄 空文件清理（按后缀筛选0KB文件）
- 📂 解散文件夹（保留N级）
- 💾 规则保存/加载（SharedPreferences）
- ⚙️ 扫描线程数配置

## 技术栈

- **Flutter** (Material Design 3) — Web 前端
- **Dart shelf/http** — 后端 REST API
- 目标平台：Windows、macOS、Linux、Web

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
    app.dart             # 主应用框架
    scan_panel.dart      # 扫描面板
    filter_panel.dart    # 筛选面板
    file_table.dart      # 文件列表
    advanced_panel.dart  # 高级功能面板
bin/
  server.dart            # Dart 后端服务器
web/
  index.html             # Flutter Web 入口
  manifest.json          # PWA 清单
```

## 开发

```bash
# 安装依赖
flutter pub get

# 运行 Web 版本
flutter run -d chrome

# 启动后端服务器
dart run bin/server.dart
```

## 构建

```bash
# Web
flutter build web

# Linux
flutter build linux

# macOS
flutter build macos

# Windows
flutter build windows
```

## CI/CD

使用 GitHub Actions 自动构建，推送到 `v*` tag 时触发多平台构建并创建 Release。
