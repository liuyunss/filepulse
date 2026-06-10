<p align="center">
  <img src="public/icon.png" width="100" alt="FilePulse Icon">
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
| 🔄 **文件旋转** | 旋转图片/视频文件，支持 EXIF 方向校正 |
| 🔍 **重复文件检测** | 基于 MD5 哈希查找并删除重复文件 |
| 💾 **配置保存** | 筛选条件保存为命名规则，一键加载，持久化到本地 |

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
- [Node.js](https://nodejs.org/) ≥ 18
- [pnpm](https://pnpm.io/) ≥ 9
- [Rust](https://www.rust-lang.org/tools/install)（stable）
- 各平台额外依赖（见下方）

```bash
# 克隆仓库
git clone https://github.com/liuyunss/filepulse.git
cd filepulse

# 安装前端依赖
pnpm install

# 运行（调试模式）
pnpm tauri dev

# 构建发布版本
pnpm tauri build
```

**Linux 额外依赖：**
```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libayatana-appindicator3-dev \
  librsvg2-dev patchelf xdg-utils
```

## 🏗️ 项目结构

```
├── src/                        # Vue 3 前端
│   ├── App.vue                 # 根组件
│   ├── main.ts                 # 入口文件
│   ├── components/
│   │   ├── DialogBox.vue       # 确认对话框
│   │   └── Sidebar.vue         # 筛选侧栏
│   ├── views/
│   │   └── MainView.vue        # 主文件列表视图
│   ├── stores/
│   │   └── filepulse.ts        # Pinia 状态管理
│   ├── types/
│   │   └── index.ts            # TypeScript 类型定义
│   └── styles/
│       └── main.css            # 全局样式
├── src-tauri/                  # Rust 后端（Tauri 2）
│   ├── src/
│   │   ├── lib.rs              # 插件注册 & 命令处理
│   │   ├── main.rs             # 入口
│   │   └── commands/
│   │       ├── file_scan.rs    # 递归文件夹扫描
│   │       ├── file_delete.rs  # 批量删除 & 空目录清理
│   │       ├── file_dissolve.rs # 文件夹拍平
│   │       ├── file_dedupe.rs  # 重复文件检测（MD5）
│   │       ├── file_rotate.rs  # 图片/视频旋转
│   │       ├── file_reveal.rs  # 在系统文件管理器中打开
│   │       └── rule_store.rs   # 筛选预设持久化
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
├── vite.config.ts
└── pnpm-lock.yaml
```

## 🛠️ 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 前端 | [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/) | 响应式 UI |
| UI 组件 | [Naive UI](https://www.naiveui.com/) | 组件库 |
| 状态管理 | [Pinia](https://pinia.vuejs.org/) | 集中状态管理 |
| CSS | [UnoCSS](https://unocss.dev/) | 原子化 CSS |
| 构建工具 | [Vite 6](https://vitejs.dev/) | 前端打包 |
| 后端 | [Tauri 2](https://v2.tauri.app/) (Rust) | 原生文件操作 |
| CI/CD | [GitHub Actions](https://docs.github.com/en/actions) | 多平台自动构建 |

## 🔄 CI/CD

使用 **GitHub Actions** 自动化构建和发布：

- 推送 `v*` 标签时自动构建 Windows (x64) / macOS (aarch64) / Linux (x64) 三平台
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
  <sub>Made with ❤️ using Vue 3 + Tauri</sub>
</p>
