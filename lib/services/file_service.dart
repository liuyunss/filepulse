import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/file_item.dart';
import '../models/filter_rule.dart';

class FileService extends ChangeNotifier {
  List<FileItem> _files = [];
  List<FileItem> _filteredFiles = [];
  String _currentPath = '';
  bool _isLoading = false;

  // ─── 筛选状态 ───
  bool _nEn = false; String _nOp = 'contains'; String _nVal = ''; bool _nNeg = false;
  bool _sEn = false; String _sOp = 'gt'; double _sVal = 10; String _sUnit = 'MB'; bool _sNeg = false;
  bool _eEn = false; String _eVal = '.jpg,.mp4'; bool _eNeg = false;
  bool _dEn = false; String _dOp = 'lt'; int _dVal = 7; String _dUnit = 'day'; bool _dNeg = false;
  bool _emEn = false; bool _emNeg = false;

  // ─── 规则 & 选择 & 预览 ───
  List<FilterRule> _rules = [];
  Set<String> _selected = {};
  bool _showPreview = false;

  // ─── Getters ───
  List<FileItem> get files => _filteredFiles;
  List<FileItem> get allFiles => _files;
  String get currentPath => _currentPath;
  bool get isLoading => _isLoading;
  int get totalCount => _files.length;
  int get filteredCount => _filteredFiles.length;
  bool get nEn => _nEn; String get nOp => _nOp; String get nVal => _nVal; bool get nNeg => _nNeg;
  bool get sEn => _sEn; String get sOp => _sOp; double get sVal => _sVal; String get sUnit => _sUnit; bool get sNeg => _sNeg;
  bool get eEn => _eEn; String get eVal => _eVal; bool get eNeg => _eNeg;
  bool get dEn => _dEn; String get dOp => _dOp; int get dVal => _dVal; String get dUnit => _dUnit; bool get dNeg => _dNeg;
  bool get emEn => _emEn; bool get emNeg => _emNeg;
  List<FilterRule> get rules => _rules;
  Set<String> get selectedPaths => _selected;
  List<FileItem> get filteredFiles => _filteredFiles;
  bool get showPreview => _showPreview;
  bool get someSelected => _selected.isNotEmpty;
  bool get allSelected => _filteredFiles.isNotEmpty && _filteredFiles.every((f) => _selected.contains(f.path));

  FileService() { _init(); }

  Future<void> _init() async {
    await _loadRules();
    notifyListeners();
  }

  // ─── 扫描文件夹（dart:io 直读） ───
  Future<void> scanFolder(String path) async {
    _isLoading = true; _selected.clear(); _showPreview = false;
    notifyListeners();

    try {
      final dir = Directory(path);
      if (!await dir.exists()) throw '文件夹不存在';
      _currentPath = path;
      _files = await _scanDir(dir, path);
      _apply();
    } catch (e) {
      debugPrint('扫描失败: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<List<FileItem>> _scanDir(Directory dir, String root) async {
    final results = <FileItem>[];
    try {
      await for (final entity in dir.list(recursive: true)) {
        if (entity is File) {
          final stat = await entity.stat();
          final relPath = p.relative(entity.path, from: root);
          results.add(FileItem(
            name: p.basename(entity.path),
            path: relPath.replaceAll('\\', '/'),
            parentPath: p.dirname(relPath).replaceAll('\\', '/'),
            size: stat.size,
            extension: p.extension(entity.path).replaceFirst('.', ''),
            modifiedAt: stat.modified,
            createdAt: stat.changed,
          ));
        }
      }
    } catch (_) {}
    return results;
  }

  // ─── 筛选更新（只存值，不立即筛选） ───
  void updateNF({bool? en, String? op, String? val, bool? neg}) { if(en!=null)_nEn=en; if(op!=null)_nOp=op; if(val!=null)_nVal=val; if(neg!=null)_nNeg=neg; notifyListeners(); }
  void updateSF({bool? en, String? op, double? val, String? unit, bool? neg}) { if(en!=null)_sEn=en; if(op!=null)_sOp=op; if(val!=null)_sVal=val; if(unit!=null)_sUnit=unit; if(neg!=null)_sNeg=neg; notifyListeners(); }
  void updateEF({bool? en, String? val, bool? neg}) { if(en!=null)_eEn=en; if(val!=null)_eVal=val; if(neg!=null)_eNeg=neg; notifyListeners(); }
  void updateDF({bool? en, String? op, int? val, String? unit, bool? neg}) { if(en!=null)_dEn=en; if(op!=null)_dOp=op; if(val!=null)_dVal=val; if(unit!=null)_dUnit=unit; if(neg!=null)_dNeg=neg; notifyListeners(); }
  void updateEF2({bool? en, bool? neg}) { if(en!=null)_emEn=en; if(neg!=null)_emNeg=neg; notifyListeners(); }

  void _apply() {
    _filteredFiles = _files.where((f) {
      if (_nEn && _nVal.isNotEmpty) {
        final nm = f.name.toLowerCase(), v = _nVal.toLowerCase();
        bool m = _nOp == 'prefix' ? nm.startsWith(v) : _nOp == 'suffix' ? nm.endsWith('.$v') : nm.contains(v);
        if (_nNeg) m = !m; if (!m) return false;
      }
      if (_sEn) {
        double s = _sUnit == 'KB' ? f.size / 1024 : _sUnit == 'GB' ? f.size / 1073741824 : f.size / 1048576;
        bool m = _sOp == 'gt' ? s > _sVal : _sOp == 'lt' ? s < _sVal : (s - _sVal).abs() < 0.001;
        if (_sNeg) m = !m; if (!m) return false;
      }
      if (_eEn && _eVal.isNotEmpty) {
        final exts = _eVal.split(',').map((e) => e.trim().toLowerCase()).toList();
        bool m = exts.contains('.${f.extension.toLowerCase()}');
        if (_eNeg) m = !m; if (!m) return false;
      }
      if (_dEn) {
        final cutoff = _dUnit == 'hour' ? DateTime.now().subtract(Duration(hours: _dVal))
            : _dUnit == 'month' ? DateTime.now().subtract(Duration(days: _dVal * 30))
            : DateTime.now().subtract(Duration(days: _dVal));
        bool m = _dOp == 'lt' ? f.modifiedAt.isAfter(cutoff) : f.modifiedAt.isBefore(cutoff);
        if (_dNeg) m = !m; if (!m) return false;
      }
      if (_emEn) {
        final dir = p.dirname(f.path);
        final sibs = _files.where((o) => p.dirname(o.path) == dir);
        bool m = sibs.every((o) => o.size == 0);
        if (_emNeg) m = !m; if (!m) return false;
      }
      return true;
    }).toList();
    notifyListeners();
  }

  // ─── 选择 ───
  void toggleSelect(String path) { _selected.contains(path) ? _selected.remove(path) : _selected.add(path); notifyListeners(); }
  void toggleSelectAll() { if (allSelected) _selected.clear(); else _selected = _filteredFiles.map((f) => f.path).toSet(); notifyListeners(); }
  void clearSelect() { _selected.clear(); notifyListeners(); }

  // ─── 删除（真正删硬盘文件） ───
  Future<int> deleteFiles(List<String> paths) async {
    int cnt = 0;
    for (final rp in paths) {
      final full = p.join(_currentPath, rp);
      final f = File(full);
      if (await f.exists()) { await f.delete(); cnt++; }
    }
    _selected.clear();
    await scanFolder(_currentPath);
    _apply(); _showPreview = true;
    return cnt;
  }

  // ─── 解散文件夹 ───
  Map<String, String> previewDissolve(int keepLevels) {
    final result = <String, String>{};
    final occupied = <String>{};
    // 先登记所有不会被移动的文件（已在目标层级），防止解散后覆盖已有文件
    for (final f in _files) {
      if (f.path.split('/').length <= keepLevels + 1) {
        occupied.add(f.path);
      }
    }
    for (final f in _files) {
      final parts = f.path.split('/');
      if (parts.length <= keepLevels + 1) continue;
      final keep = parts.sublist(0, keepLevels);
      final baseName = parts.last;
      final baseDir = keep.isEmpty ? '.' : keep.join('/');
      String candidate = baseDir == '.' ? baseName : '$baseDir/$baseName';
      // 冲突处理：目标路径已被占用（已有文件 或 之前安排的文件）
      if (occupied.contains(candidate)) {
        final ext = p.extension(baseName);
        final stem = p.basenameWithoutExtension(baseName);
        int counter = 1;
        do {
          candidate = baseDir == '.' ? '${stem}_$counter$ext' : '$baseDir/${stem}_$counter$ext';
          counter++;
        } while (occupied.contains(candidate));
      }
      if (candidate != f.path) {
        occupied.add(candidate);
        result[f.path] = candidate;
      }
    }
    return result;
  }

  Future<void> dissolveFolder(int keepLevels) async {
    if (_currentPath.isEmpty || _files.isEmpty) return;
    final toMove = previewDissolve(keepLevels);
    if (toMove.isEmpty) return;
    // 记录哪些源目录会有文件被移走
    final sourceDirs = <String>{};
    for (final entry in toMove.entries) {
      final src = File(p.join(_currentPath, entry.key));
      final dst = File(p.join(_currentPath, entry.value));
      if (await src.exists()) {
        await dst.parent.create(recursive: true);
        await src.rename(dst.path);
        sourceDirs.add(p.dirname(entry.key));
      }
    }
    // 清理变空的源目录
    await _cleanEmptyDirs();
    await scanFolder(_currentPath);
  }

  /// 扫描空文件夹
  Future<List<String>> findEmptyDirs() async {
    if (_currentPath.isEmpty) return [];
    final empty = <String>[];
    final base = Directory(_currentPath);
    if (!await base.exists()) return empty;
    await for (final entity in base.list(recursive: true)) {
      if (entity is Directory) {
        final list = entity.listSync();
        if (list.isEmpty) {
          empty.add(p.relative(entity.path, from: _currentPath).replaceAll('\\', '/'));
        }
      }
    }
    empty.sort();
    return empty;
  }

  /// 删除指定空文件夹
  Future<int> deleteEmptyDirs(List<String> dirs) async {
    int cnt = 0;
    // 按路径深度倒序删除（深的先删）
    dirs.sort((a, b) => b.split('/').length.compareTo(a.split('/').length));
    for (final d in dirs) {
      final dir = Directory(p.join(_currentPath, d));
      if (await dir.exists()) {
        try { await dir.delete(); cnt++; } catch (_) {}
      }
    }
    await scanFolder(_currentPath);
    return cnt;
  }

  /// 清理所有空目录
  Future<void> _cleanEmptyDirs() async {
    final empty = await findEmptyDirs();
    if (empty.isNotEmpty) await deleteEmptyDirs(empty);
  }

  // 是否有解散操作可用
  bool get canDissolve => _currentPath.isNotEmpty && _files.any((f) => f.path.split('/').length > 2);

  // ─── 预览（点击时重扫+筛选） ───
  void openPreview() { _apply(); _showPreview = true; notifyListeners(); }
  void closePreview() { _showPreview = false; notifyListeners(); }
  Future<void> togglePreview() async {
    if (!_showPreview && _currentPath.isNotEmpty) {
      final dir = Directory(_currentPath);
      if (await dir.exists()) {
        _isLoading = true; notifyListeners();
        _files = await _scanDir(dir, _currentPath);
        _isLoading = false;
      }
    }
    _apply();
    _showPreview = !_showPreview;
    notifyListeners();
  }
  void togglePvSelect(String path) { _selected.contains(path) ? _selected.remove(path) : _selected.add(path); notifyListeners(); }

  // ─── 规则 ───
  FilterRule currentState(String name) => FilterRule(name: name, nEn: _nEn, nOp: _nOp, nVal: _nVal, nNeg: _nNeg, sEn: _sEn, sOp: _sOp, sVal: _sVal, sUnit: _sUnit, sNeg: _sNeg, eEn: _eEn, eVal: _eVal, eNeg: _eNeg, dEn: _dEn, dOp: _dOp, dVal: _dVal, dUnit: _dUnit, dNeg: _dNeg, emEn: _emEn, emNeg: _emNeg);
  void applyRule(FilterRule r) { _nEn=r.nEn;_nOp=r.nOp;_nVal=r.nVal;_nNeg=r.nNeg; _sEn=r.sEn;_sOp=r.sOp;_sVal=r.sVal;_sUnit=r.sUnit;_sNeg=r.sNeg; _eEn=r.eEn;_eVal=r.eVal;_eNeg=r.eNeg; _dEn=r.dEn;_dOp=r.dOp;_dVal=r.dVal;_dUnit=r.dUnit;_dNeg=r.dNeg; _emEn=r.emEn;_emNeg=r.emNeg; _apply(); }
  Future<bool> saveRule(String name) async {
    final idx = _rules.indexWhere((r) => r.name == name);
    if (idx >= 0) {
      _rules[idx] = currentState(name); // 同名覆盖
    } else {
      if (_rules.length >= 5) return false; // 已达上限
      _rules.add(currentState(name));
    }
    await _persist(); notifyListeners();
    return true;
  }
  Future<void> deleteRule(int i) async { _rules.removeAt(i); await _persist(); notifyListeners(); }

  Future<void> _loadRules() async {
    try {
      final p = await SharedPreferences.getInstance();
      final j = p.getString('fp_rules');
      if (j != null) _rules = (jsonDecode(j) as List).map((r) => FilterRule.fromJson(r)).toList();
      debugPrint('已加载 ${_rules.length} 条配置');
    } catch (e) {
      debugPrint('配置加载失败: $e');
    }
  }
  Future<void> _persist() async {
    try {
      final p = await SharedPreferences.getInstance();
      await p.setString('fp_rules', jsonEncode(_rules.map((r) => r.toJson()).toList()));
      debugPrint('已保存 ${_rules.length} 条配置');
    } catch (e) {
      debugPrint('配置保存失败: $e');
    }
  }
}
