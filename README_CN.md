<p align="center">
  <img src="macos/Runner/Assets.xcassets/AppIcon.appiconset/app_icon_256.png" width="100" alt="FilePulse Icon">
</p>

<h1 align="center">FilePulse（文件脉搏）</h1>

<p align="center">
  <strong>跨平台文件分析筛选工具</strong><br>
  快速扫描、精准筛选、批量清理你的文件系统
</p>

<p align="center">
  <a href="https://github.com/liuyunss/filepulse/releases/latest"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/liuyunss/filepulse?style=flat-square"></a>
  <a href="https://github.com/liuyunss/filepulse/blob/dev/LICENSE"><img alt="License" src="https://img.shields.io/github/license/liuyunss/filepulse?style=flat-square"></a>
  <a href="https://github.com/liuyunss/filepulse/actions"><img alt="Build" src="https://img.shields.io/github/actions/workflow/status/liuyunss/filepulse/build.yml?branch=dev&style=flat-square&label=build"></a>
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=flat-square">
</p>

<p align="center">
  <a href="README.md">🇺🇸 English</a>
</p>

---

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 📁 **文件夹扫描** | 拖入或浏览选择文件夹，递归扫描全部子目录 |
| 🔍 **多维筛选** | 名称（包含/前缀/后缀）、大小（>/</=）、文件后缀、修改日期，每个条件均可**取反** |
| 📋 **文件列表** | 路径、大小、类型（彩色标签）、修改时间，支持表头排序 |
| ☑️ **批量操作** | 全选 / 单选 → 批量删除（带确认对话框） |
| 🗑️ **空文件夹清理** | 一键扫描并删除所有空目录 |
| 📂 **文件夹解散** | 保留 N 级目录后拍平文件结构，预览→确认，自动处理同名冲突 + 清理空目录 |
| 💾 **配置保存** | 筛选条件保存为命名规则（最多 5 条），一键加载，持久化到本地 |

## 🚀 快速开始

### 下载安装

前往 [**Releases 页面**](https://github.com/liuyunss/filepulse/releases/latest) 下载对应平台的压缩包：

| 平台 | 文件 | 说明 |
|------|------|------|
| 🪟 Windows | `FilePulse_*_windows_x64.zip` | 解压后运行 `FilePulse.exe` |
| 🍎 macOS | `FilePulse_*_macos.zip` | 解压后运行 `FilePulse.app` |
| 🐧 Linux | `FilePulse_*_linux_x64.tar.gz` | 解压后运行 `FilePulse` |

### 从源码构建

**环境要求：**
- [Flutter SDK](https://docs.flutter.dev/get-started/install) ≥ 3.0
- 各平台桌面开发工具链（详见 [Flutter Desktop](https://docs.flutter.dev/platform-integration/desktop)）

```bash
# 克隆仓库
git clone https://github.com/liuyunss/filepulse.git
cd filepulse

# 安装依赖
flutter pub get

# 运行（调试模式）
flutter run -d windows   # Windows
flutter run -d macos     # macOS
flutter run -d linux     # Linux

# 构建发布版本
flutter build windows --release
flutter build macos --release
flutter build linux --release
```

**Linux 额外依赖：**
```bash
sudo apt-get install -y ninja-build libgtk-3-dev
```

## 🏗️ 项目结构

```
lib/
├── main.dart                  # 入口
├── models/
│   ├── file_item.dart         # 文件数据模型
│   └── filter_rule.dart       # 筛选规则模型（可序列化）
├── services/
│   └── file_service.dart      # 核心业务逻辑（扫描/筛选/删除/解散）
└── widgets/
    └── app.dart               # 全部 UI（侧栏筛选 + 文件列表 + 工具面板）
```

## 🛠️ 技术栈

| 技术 | 用途 |
|------|------|
| [Flutter](https://flutter.dev) | 跨平台桌面 UI（Material Design 3） |
| `dart:io` | 直接文件系统操作（无服务端） |
| [provider](https://pub.dev/packages/provider) | 状态管理 |
| [shared_preferences](https://pub.dev/packages/shared_preferences) | 配置持久化 |
| [desktop_drop](https://pub.dev/packages/desktop_drop) | 拖放支持 |
| [file_picker](https://pub.dev/packages/file_picker) | 原生文件夹选择 |

## 🔄 CI/CD

使用 **GitHub Actions** 自动化构建和发布：

- 推送 `v*` 标签时自动构建 Windows / macOS / Linux 三平台
- 自动创建 GitHub Release 并上传产物
- 支持手动触发（`workflow_dispatch`）

工作流文件：[`.github/workflows/build.yml`](.github/workflows/build.yml)

## 📋 使用示例

**场景 1：清理下载目录中的大文件**
1. 拖入 `~/Downloads` 文件夹
2. 勾选「大小」→ 选择 `>` → 输入 `100` → 选择 `MB`
3. 点击「预览匹配」确认
4. 选中文件 → 点击「删除选中」

**场景 2：批量删除特定后缀文件**
1. 勾选「后缀」→ 输入 `.log,.tmp,.cache`
2. 预览匹配 → 全选 → 删除

**场景 3：解散深层目录**
1. 勾选「解散文件夹」→ 设置保留级别（如 1 级）
2. 点击「解散预览」→ 确认原路径→新路径对照
3. 确认解散（自动处理同名冲突）

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/my-feature`
3. 提交更改：`git commit -m 'Add some feature'`
4. 推送分支：`git push origin feature/my-feature`
5. 创建 Pull Request

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

---

<p align="center">
  <sub>Made with ❤️ using Flutter</sub>
</p>
