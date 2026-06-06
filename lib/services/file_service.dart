import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/file_item.dart';
import '../models/filter_rule.dart';

class FileService extends ChangeNotifier {
  List<FileItem> _files = [];
  List<FileItem> _filteredFiles = [];
  String _currentPath = '';
  bool _isLoading = false;
  String? _error;

  // 名称筛选
  bool _nameFilterEnabled = false;
  String _nameOperator = 'contains';
  String _nameValue = '';
  bool _nameNegate = false;

  // 大小筛选
  bool _sizeFilterEnabled = false;
  String _sizeOperator = 'gt';
  double _sizeValue = 10;
  String _sizeUnit = 'MB';
  bool _sizeNegate = false;

  // 后缀筛选
  bool _extFilterEnabled = false;
  String _extValue = '';
  bool _extNegate = false;

  // 日期筛选
  bool _dateFilterEnabled = false;
  int _dateValue = 7;
  bool _dateNegate = false;

  // 空文件夹筛选
  bool _emptyFilterEnabled = false;
  bool _emptyNegate = false;

  // 高级功能
  int _threadCount = 4;
  List<FilterRule> _savedRules = [];
  bool _showAdvancedPanel = false;
  bool _showDupPanel = false;
  bool _showEmptyCleanupPanel = false;

  // 重复文件检测结果
  List<List<FileItem>> _duplicateGroups = [];

  // 空文件清理结果
  List<FileItem> _emptyFiles = [];
  String _emptyExtFilter = '.txt,.log,.tmp';

  // 全选状态
  Set<String> _selectedPaths = {};

  // ─── Getters ─────────────────────────────────────────────
  List<FileItem> get files => _filteredFiles;
  String get currentPath => _currentPath;
  bool get isLoading => _isLoading;
  String? get error => _error;
  int get totalCount => _files.length;
  int get filteredCount => _filteredFiles.length;

  bool get nameFilterEnabled => _nameFilterEnabled;
  String get nameOperator => _nameOperator;
  String get nameValue => _nameValue;
  bool get nameNegate => _nameNegate;

  bool get sizeFilterEnabled => _sizeFilterEnabled;
  String get sizeOperator => _sizeOperator;
  double get sizeValue => _sizeValue;
  String get sizeUnit => _sizeUnit;
  bool get sizeNegate => _sizeNegate;

  bool get extFilterEnabled => _extFilterEnabled;
  String get extValue => _extValue;
  bool get extNegate => _extNegate;

  bool get dateFilterEnabled => _dateFilterEnabled;
  int get dateValue => _dateValue;
  bool get dateNegate => _dateNegate;

  bool get emptyFilterEnabled => _emptyFilterEnabled;
  bool get emptyNegate => _emptyNegate;

  int get threadCount => _threadCount;
  List<FilterRule> get savedRules => _savedRules;
  bool get showAdvancedPanel => _showAdvancedPanel;
  bool get showDupPanel => _showDupPanel;
  bool get showEmptyCleanupPanel => _showEmptyCleanupPanel;
  List<List<FileItem>> get duplicateGroups => _duplicateGroups;
  List<FileItem> get emptyFiles => _emptyFiles;
  String get emptyExtFilter => _emptyExtFilter;
  Set<String> get selectedPaths => _selectedPaths;

  bool get allSelected =>
      _filteredFiles.isNotEmpty &&
      _filteredFiles.every((f) => _selectedPaths.contains(f.path));
  bool get someSelected => _selectedPaths.isNotEmpty;

  // API 基础地址
  static String get _apiBase {
    if (kIsWeb) return '/api';
    return 'http://localhost:8080/api';
  }

  FileService() {
    _loadRules();
  }

  // ─── 扫描 ───────────────────────────────────────────────
  Future<void> scanFolder(String path) async {
    _isLoading = true;
    _error = null;
    _selectedPaths.clear();
    notifyListeners();

    try {
      final response = await http.post(
        Uri.parse('$_apiBase/scan'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'path': path, 'threads': _threadCount}),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        _files = (data['files'] as List)
            .map((f) => FileItem.fromJson(f))
            .toList();
        _currentPath = path;
        _applyFilters();
      } else {
        _error = '扫描失败: ${response.statusCode}';
      }
    } catch (e) {
      _error = '连接失败: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // ─── 名称筛选 ────────────────────────────────────────────
  void updateNameFilter(
      {bool? enabled, String? op, String? value, bool? negate}) {
    if (enabled != null) _nameFilterEnabled = enabled;
    if (op != null) _nameOperator = op;
    if (value != null) _nameValue = value;
    if (negate != null) _nameNegate = negate;
    _applyFilters();
    notifyListeners();
  }

  // ─── 大小筛选 ────────────────────────────────────────────
  void updateSizeFilter(
      {bool? enabled, String? op, double? value, String? unit, bool? negate}) {
    if (enabled != null) _sizeFilterEnabled = enabled;
    if (op != null) _sizeOperator = op;
    if (value != null) _sizeValue = value;
    if (unit != null) _sizeUnit = unit;
    if (negate != null) _sizeNegate = negate;
    _applyFilters();
    notifyListeners();
  }

  // ─── 后缀筛选 ────────────────────────────────────────────
  void updateExtFilter({bool? enabled, String? value, bool? negate}) {
    if (enabled != null) _extFilterEnabled = enabled;
    if (value != null) _extValue = value;
    if (negate != null) _extNegate = negate;
    _applyFilters();
    notifyListeners();
  }

  // ─── 日期筛选 ────────────────────────────────────────────
  void updateDateFilter({bool? enabled, int? value, bool? negate}) {
    if (enabled != null) _dateFilterEnabled = enabled;
    if (value != null) _dateValue = value;
    if (negate != null) _dateNegate = negate;
    _applyFilters();
    notifyListeners();
  }

  // ─── 空文件夹筛选 ────────────────────────────────────────
  void updateEmptyFilter({bool? enabled, bool? negate}) {
    if (enabled != null) _emptyFilterEnabled = enabled;
    if (negate != null) _emptyNegate = negate;
    _applyFilters();
    notifyListeners();
  }

  // ─── 应用筛选 ────────────────────────────────────────────
  void _applyFilters() {
    _filteredFiles = _files.where((f) {
      // 名称筛选
      if (_nameFilterEnabled && _nameValue.isNotEmpty) {
        final name = f.name.toLowerCase();
        final value = _nameValue.toLowerCase();
        bool match;
        switch (_nameOperator) {
          case 'prefix':
            match = name.startsWith(value);
            break;
          case 'suffix':
            match = name.endsWith(value);
            break;
          default: // contains
            match = name.contains(value);
        }
        if (_nameNegate) match = !match;
        if (!match) return false;
      }

      // 大小筛选
      if (_sizeFilterEnabled) {
        double sizeInUnit;
        switch (_sizeUnit) {
          case 'KB':
            sizeInUnit = f.size / 1024;
            break;
          case 'GB':
            sizeInUnit = f.size / (1024 * 1024 * 1024);
            break;
          default: // MB
            sizeInUnit = f.size / (1024 * 1024);
        }

        bool match;
        switch (_sizeOperator) {
          case 'gt':
            match = sizeInUnit > _sizeValue;
            break;
          case 'lt':
            match = sizeInUnit < _sizeValue;
            break;
          case 'eq':
            match = (sizeInUnit - _sizeValue).abs() < 0.001;
            break;
          default:
            match = false;
        }

        if (_sizeNegate) match = !match;
        if (!match) return false;
      }

      // 后缀筛选
      if (_extFilterEnabled && _extValue.isNotEmpty) {
        final exts = _extValue
            .split(',')
            .map((e) => e.trim().toLowerCase())
            .toList();
        final fileExt = '.${f.extension.toLowerCase()}';
        bool match = exts.any((ext) {
          if (ext.contains('*')) {
            return fileExt.contains(ext.replaceAll('*', ''));
          }
          return fileExt == ext;
        });
        if (_extNegate) match = !match;
        if (!match) return false;
      }

      // 日期筛选
      if (_dateFilterEnabled) {
        final cutoff = DateTime.now().subtract(Duration(days: _dateValue));
        bool match = f.modifiedAt.isAfter(cutoff);
        if (_dateNegate) match = !match;
        if (!match) return false;
      }

      // 空文件夹筛选
      if (_emptyFilterEnabled) {
        bool match = f.isDirectory;
        if (_emptyNegate) match = !match;
        if (!match) return false;
      }

      return true;
    }).toList();
  }

  // ─── 选择操作 ────────────────────────────────────────────
  void toggleSelect(String path) {
    if (_selectedPaths.contains(path)) {
      _selectedPaths.remove(path);
    } else {
      _selectedPaths.add(path);
    }
    notifyListeners();
  }

  void toggleSelectAll() {
    if (allSelected) {
      _selectedPaths.clear();
    } else {
      _selectedPaths = _filteredFiles.map((f) => f.path).toSet();
    }
    notifyListeners();
  }

  void clearSelection() {
    _selectedPaths.clear();
    notifyListeners();
  }

  // ─── 删除 ────────────────────────────────────────────────
  Future<void> deleteFiles(List<String> paths) async {
    try {
      final response = await http.post(
        Uri.parse('$_apiBase/delete'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'paths': paths}),
      );

      if (response.statusCode == 200) {
        _selectedPaths.clear();
        await scanFolder(_currentPath);
      } else {
        _error = '删除失败: ${response.statusCode}';
        notifyListeners();
      }
    } catch (e) {
      _error = '删除失败: $e';
      notifyListeners();
    }
  }

  // ─── 解散文件夹 ──────────────────────────────────────────
  Future<void> dissolveFolder(String path, int keepLevels) async {
    try {
      final response = await http.post(
        Uri.parse('$_apiBase/dissolve'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'path': path, 'keepLevels': keepLevels}),
      );

      if (response.statusCode == 200) {
        await scanFolder(_currentPath);
      } else {
        _error = '解散失败: ${response.statusCode}';
        notifyListeners();
      }
    } catch (e) {
      _error = '解散失败: $e';
      notifyListeners();
    }
  }

  // ─── 重复文件检测 ────────────────────────────────────────
  void detectDuplicates() {
    final Map<String, List<FileItem>> groups = {};
    for (final f in _files) {
      if (f.isDirectory) continue;
      final key = f.duplicateKey;
      groups.putIfAbsent(key, () => []).add(f);
    }
    _duplicateGroups = groups.values
        .where((g) => g.length > 1)
        .toList()
      ..sort((a, b) =>
          (b[0].size * b.length).compareTo(a[0].size * a.length));
    _showDupPanel = true;
    notifyListeners();
  }

  // ─── 空文件扫描 ──────────────────────────────────────────
  void scanEmptyFiles() {
    final exts = _emptyExtFilter
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .toList();
    _emptyFiles = _files.where((f) {
      if (f.size != 0) return false;
      if (f.isDirectory) return false;
      final fileExt = '.${f.extension.toLowerCase()}';
      return exts.any((ext) {
        if (ext.contains('*')) {
          return fileExt.contains(ext.replaceAll('*', ''));
        }
        return fileExt == ext;
      });
    }).toList();
    _showEmptyCleanupPanel = true;
    notifyListeners();
  }

  void updateEmptyExtFilter(String value) {
    _emptyExtFilter = value;
    notifyListeners();
  }

  // ─── 高级面板 ────────────────────────────────────────────
  void toggleAdvancedPanel() {
    _showAdvancedPanel = !_showAdvancedPanel;
    notifyListeners();
  }

  void toggleDupPanel() {
    _showDupPanel = !_showDupPanel;
    notifyListeners();
  }

  void toggleEmptyCleanupPanel() {
    _showEmptyCleanupPanel = !_showEmptyCleanupPanel;
    notifyListeners();
  }

  // ─── 线程数 ──────────────────────────────────────────────
  void updateThreadCount(int count) {
    _threadCount = count.clamp(1, 32);
    notifyListeners();
  }

  // ─── 规则管理 ────────────────────────────────────────────
  FilterRule getCurrentRuleState() {
    return FilterRule(
      nameFilterEnabled: _nameFilterEnabled,
      nameOperator: _nameOperator,
      nameValue: _nameValue,
      nameNegate: _nameNegate,
      sizeFilterEnabled: _sizeFilterEnabled,
      sizeOperator: _sizeOperator,
      sizeValue: _sizeValue,
      sizeUnit: _sizeUnit,
      sizeNegate: _sizeNegate,
      extFilterEnabled: _extFilterEnabled,
      extValue: _extValue,
      extNegate: _extNegate,
      dateFilterEnabled: _dateFilterEnabled,
      dateValue: _dateValue,
      dateNegate: _dateNegate,
      emptyFilterEnabled: _emptyFilterEnabled,
      emptyNegate: _emptyNegate,
    );
  }

  void applyRule(FilterRule rule) {
    _nameFilterEnabled = rule.nameFilterEnabled;
    _nameOperator = rule.nameOperator;
    _nameValue = rule.nameValue;
    _nameNegate = rule.nameNegate;
    _sizeFilterEnabled = rule.sizeFilterEnabled;
    _sizeOperator = rule.sizeOperator;
    _sizeValue = rule.sizeValue;
    _sizeUnit = rule.sizeUnit;
    _sizeNegate = rule.sizeNegate;
    _extFilterEnabled = rule.extFilterEnabled;
    _extValue = rule.extValue;
    _extNegate = rule.extNegate;
    _dateFilterEnabled = rule.dateFilterEnabled;
    _dateValue = rule.dateValue;
    _dateNegate = rule.dateNegate;
    _emptyFilterEnabled = rule.emptyFilterEnabled;
    _emptyNegate = rule.emptyNegate;
    _applyFilters();
    notifyListeners();
  }

  Future<void> saveRule(String name) async {
    final rule = getCurrentRuleState();
    rule.name = name;
    _savedRules.add(rule);
    await _persistRules();
    notifyListeners();
  }

  Future<void> deleteRule(int index) async {
    if (index >= 0 && index < _savedRules.length) {
      _savedRules.removeAt(index);
      await _persistRules();
      notifyListeners();
    }
  }

  Future<void> _loadRules() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final json = prefs.getString('filepulse_rules');
      if (json != null) {
        final list = jsonDecode(json) as List;
        _savedRules = list.map((r) => FilterRule.fromJson(r)).toList();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('加载规则失败: $e');
    }
  }

  Future<void> _persistRules() async {
    final prefs = await SharedPreferences.getInstance();
    final json = jsonEncode(_savedRules.map((r) => r.toJson()).toList());
    await prefs.setString('filepulse_rules', json);
  }
}
