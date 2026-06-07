<p align="center">
  <img src="macos/Runner/Assets.xcassets/AppIcon.appiconset/app_icon_256.png" width="100" alt="FilePulse Icon">
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
| 💾 **Filter Presets** | Save filter configurations as named rules (up to 5), one-click load, persisted locally |

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
- [Flutter SDK](https://docs.flutter.dev/get-started/install) ≥ 3.0
- Platform-specific desktop toolchain (see [Flutter Desktop](https://docs.flutter.dev/platform-integration/desktop))

```bash
# Clone the repo
git clone https://github.com/liuyunss/filepulse.git
cd filepulse

# Install dependencies
flutter pub get

# Run (debug mode)
flutter run -d windows   # Windows
flutter run -d macos     # macOS
flutter run -d linux     # Linux

# Build release
flutter build windows --release
flutter build macos --release
flutter build linux --release
```

**Linux additional dependencies:**
```bash
sudo apt-get install -y ninja-build libgtk-3-dev
```

## 🏗️ Project Structure

```
lib/
├── main.dart                  # Entry point
├── models/
│   ├── file_item.dart         # File data model
│   └── filter_rule.dart       # Filter rule model (serializable)
├── services/
│   └── file_service.dart      # Core logic (scan / filter / delete / dissolve)
└── widgets/
    └── app.dart               # All UI (sidebar filters + file list + tools)
```

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| [Flutter](https://flutter.dev) | Cross-platform desktop UI (Material Design 3) |
| `dart:io` | Direct filesystem operations (no server) |
| [provider](https://pub.dev/packages/provider) | State management |
| [shared_preferences](https://pub.dev/packages/shared_preferences) | Local config persistence |
| [desktop_drop](https://pub.dev/packages/desktop_drop) | Drag & drop support |
| [file_picker](https://pub.dev/packages/file_picker) | Native folder picker |

## 🔄 CI/CD

Powered by **GitHub Actions**:

- Auto-builds for Windows / macOS / Linux on `v*` tag push
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
  <sub>Made with ❤️ using Flutter</sub>
</p>
