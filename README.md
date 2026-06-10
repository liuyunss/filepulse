<p align="center">
  <img src="public/icon.png" width="100" alt="FilePulse Icon">
</p>

<h1 align="center">FilePulse</h1>

<p align="center">
  <strong>Cross-platform file analysis & filtering tool</strong><br>
  Scan, filter, and clean up your file system — fast and precise.
</p>

<p align="center">
  <a href="https://github.com/liuyunss/filepulse/releases/latest"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/liuyunss/filepulse?style=flat-square"></a>
  <a href="https://github.com/liuyunss/filepulse/blob/dev/LICENSE"><img alt="License" src="https://img.shields.io/github/license/liuyunss/filepulse?style=flat-square"></a>
  <a href="https://github.com/liuyunss/filepulse/actions"><img alt="Build" src="https://img.shields.io/github/actions/workflow/status/liuyunss/filepulse/build.yml?branch=dev&style=flat-square&label=build"></a>
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=flat-square">
</p>

<p align="center">
  <a href="README_CN.md">🇨🇳 中文文档</a>
</p>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📁 **Folder Scanning** | Drag & drop or browse to select a folder — recursively scans all subdirectories |
| 🔍 **Multi-dimensional Filtering** | Name (contains/prefix/suffix), size (> / < / =), extension, modification date — each condition supports **negation** |
| 📋 **File List** | Path, size, type (color-coded tags), modified time — sortable columns |
| ☑️ **Batch Operations** | Select all / individual → batch delete (with confirmation dialog) |
| 🗑️ **Empty Folder Cleanup** | One-click scan and delete all empty directories |
| 📂 **Folder Dissolving** | Flatten file structure by keeping N levels of directories — preview before confirm, auto-resolve name conflicts + clean up empty dirs |
| 🔄 **File Rotation** | Rotate image/video files with EXIF-aware orientation correction |
| 🔍 **Duplicate Detection** | Find and remove duplicate files by MD5 hash |
| 💾 **Filter Presets** | Save filter configurations as named rules, one-click load, persisted locally |

## 🚀 Quick Start

### Download

Go to the [**Releases page**](https://github.com/liuyunss/filepulse/releases/latest) to download the package for your platform:

| Platform | File | Instructions |
|----------|------|--------------|
| 🪟 Windows | `FilePulse_*_windows_x64.zip` | Extract and run `FilePulse.exe` |
| 🍎 macOS | `FilePulse_*_macos.zip` | Extract and run `FilePulse.app` |
| 🐧 Linux | `FilePulse_*_linux_x64.tar.gz` | Extract and run `FilePulse` |

### Build from Source

**Prerequisites:**
- [Node.js](https://nodejs.org/) ≥ 18
- [pnpm](https://pnpm.io/) ≥ 9
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- Platform-specific dependencies (see below)

```bash
# Clone the repo
git clone https://github.com/liuyunss/filepulse.git
cd filepulse

# Install frontend dependencies
pnpm install

# Run in dev mode
pnpm tauri dev

# Build release
pnpm tauri build
```

**Linux additional dependencies:**
```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libayatana-appindicator3-dev \
  librsvg2-dev patchelf xdg-utils
```

## 🏗️ Project Structure

```
├── src/                        # Vue 3 frontend
│   ├── App.vue                 # Root component
│   ├── main.ts                 # Entry point
│   ├── components/
│   │   ├── DialogBox.vue       # Confirmation dialogs
│   │   └── Sidebar.vue         # Filter sidebar
│   ├── views/
│   │   └── MainView.vue        # Main file list view
│   ├── stores/
│   │   └── filepulse.ts        # Pinia state management
│   ├── types/
│   │   └── index.ts            # TypeScript type definitions
│   └── styles/
│       └── main.css            # Global styles
├── src-tauri/                  # Rust backend (Tauri 2)
│   ├── src/
│   │   ├── lib.rs              # Plugin registration & command handlers
│   │   ├── main.rs             # Entry point
│   │   └── commands/
│   │       ├── file_scan.rs    # Recursive folder scanning
│   │       ├── file_delete.rs  # Batch delete & empty dir cleanup
│   │       ├── file_dissolve.rs # Folder flattening
│   │       ├── file_dedupe.rs  # Duplicate detection (MD5)
│   │       ├── file_rotate.rs  # Image/video rotation
│   │       ├── file_reveal.rs  # Open in system file manager
│   │       └── rule_store.rs   # Filter preset persistence
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
├── vite.config.ts
└── pnpm-lock.yaml
```

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/) | Reactive UI |
| UI Components | [Naive UI](https://www.naiveui.com/) | Component library |
| State Management | [Pinia](https://pinia.vuejs.org/) | Centralized state |
| CSS | [UnoCSS](https://unocss.dev/) | Atomic CSS engine |
| Build Tool | [Vite 6](https://vitejs.dev/) | Frontend bundler |
| Backend | [Tauri 2](https://v2.tauri.app/) (Rust) | Native file operations |
| CI/CD | [GitHub Actions](https://docs.github.com/en/actions) | Multi-platform auto-build |

## 🔄 CI/CD

Powered by **GitHub Actions**:

- Auto-builds for Windows (x64) / macOS (aarch64) / Linux (x64) on `v*` tag push
- Auto-creates GitHub Release with platform artifacts
- Manual trigger supported (`workflow_dispatch`)

Workflow file: [`.github/workflows/build.yml`](.github/workflows/build.yml)

## 📋 Usage Examples

**Scenario 1: Clean large files from Downloads**
1. Drag the `~/Downloads` folder into FilePulse
2. Enable "Size" → select `>` → enter `100` → select `MB`
3. Click "Preview" to confirm matches
4. Select files → click "Delete Selected"

**Scenario 2: Batch delete specific file types**
1. Enable "Extension" → enter `.log,.tmp,.cache`
2. Preview matches → Select All → Delete

**Scenario 3: Flatten deep directory structure**
1. Enable "Dissolve Folder" → set retention level (e.g., 1)
2. Click "Dissolve Preview" → review original → new path mapping
3. Confirm dissolve (auto-handles name conflicts)

## 🤝 Contributing

Issues and Pull Requests are welcome!

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m 'Add some feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  <sub>Made with ❤️ using Vue 3 + Tauri</sub>
</p>
