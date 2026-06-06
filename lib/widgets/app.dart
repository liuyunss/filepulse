import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:desktop_drop/desktop_drop.dart';
import 'package:file_picker/file_picker.dart';
import '../services/file_service.dart';
import '../models/file_item.dart';

class FilePulseApp extends StatelessWidget {
  const FilePulseApp({super.key});
  @override Widget build(BuildContext ctx) => MaterialApp(
    debugShowCheckedModeBanner: false, themeMode: ThemeMode.light,
    theme: ThemeData.light(useMaterial3: true).copyWith(colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1B74E4))),
    home: const MainScreen(),
  );
}

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});
  @override State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  bool dragging = false;
  bool dissolveMode = false;
  bool emptyDirMode = false;
  int dissolveLevel = 1;
  String _sortBy = 'path';
  bool _sortAsc = true;

  @override Widget build(BuildContext ctx) => DropTarget(
    onDragEntered: (_) => setState(() => dragging = true),
    onDragExited: (_) => setState(() => dragging = false),
    onDragDone: (d) { setState(() => dragging = false); if (d.files.isNotEmpty) _tryDrop(ctx, d.files.first.path); },
    child: Scaffold(body: Column(children: [
      _header(ctx),
      Expanded(child: Row(children: [
        SizedBox(width: 310, child: _sidebar(ctx)),
        const VerticalDivider(width: 1),
        Expanded(child: _main(ctx)),
      ])),
    ])),
  );

  void _tryDrop(BuildContext ctx, String path) {
    if (Directory(path).existsSync()) {
      ctx.read<FileService>().scanFolder(path);
    } else if (File(path).existsSync()) {
      ctx.read<FileService>().scanFolder(File(path).parent.path);
    }
  }

  // ── 顶栏 ──
  Widget _header(BuildContext ctx) {
    final s = ctx.watch<FileService>();
    final dropWidget = InkWell(
      onTap: () async {
        final r = await FilePicker.platform.getDirectoryPath(dialogTitle: '选择文件夹');
        if (r != null) s.scanFolder(r);
      },
      child: Container(
        height: 42,
        decoration: BoxDecoration(
          border: Border.all(color: dragging ? Colors.blue : Colors.grey.shade300, width: 2),
          borderRadius: BorderRadius.circular(6),
          color: dragging ? Colors.blue.shade50 : Colors.grey.shade50,
        ),
        child: Center(child: Text('📁 拖入文件夹 或 点击浏览', style: TextStyle(color: Colors.grey.shade600))),
      ),
    );
    return Container(padding: const EdgeInsets.all(10), color: Colors.white, child: Row(children: [
      const Text('FilePulse 文件脉搏', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
      const SizedBox(width: 16),
      Expanded(child: dropWidget),
      const SizedBox(width: 16),
      if (s.currentPath.isNotEmpty) Flexible(child: Text(s.currentPath, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, color: Colors.grey.shade500))),
    ]));
  }

  // ── 侧栏 ──
  Widget _sidebar(BuildContext ctx) {
    final s = ctx.watch<FileService>();
    return Container(color: Colors.white, child: ListView(padding: const EdgeInsets.all(10), children: [
      const Text('🔍 筛选条件', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
      const SizedBox(height: 6),
      Opacity(opacity: (dissolveMode || emptyDirMode) ? 0.4 : 1.0, child: AbsorbPointer(absorbing: dissolveMode || emptyDirMode, child: Column(children: [
        _filterRow('名称', s.nEn, (v) => s.updateNF(en: v), [
          _dd(s.nOp, ['包含','前缀','后缀'], ['contains','prefix','suffix'], (v) => s.updateNF(op: v), 56),
          _tf(s.nVal, '关键词', (v) => s.updateNF(val: v), 76),
          _neg(s.nNeg, (v) => s.updateNF(neg: v)),
        ]),
        _filterRow('后缀', s.eEn, (v) => s.updateEF(en: v), [
          _tf(s.eVal, '.jpg,.mp4', (v) => s.updateEF(val: v), 130),
          _neg(s.eNeg, (v) => s.updateEF(neg: v)),
        ]),
        _filterRow('大小', s.sEn, (v) => s.updateSF(en: v), [
          _dd(s.sOp, ['>','<','='], ['gt','lt','eq'], (v) => s.updateSF(op: v), 38),
          _stepper(s.sVal.toString(), (v) => s.updateSF(val: double.tryParse(v) ?? 10), 75, step: 1),
          _dd(s.sUnit, ['KB','MB','GB'], ['KB','MB','GB'], (v) => s.updateSF(unit: v), 46),
          _neg(s.sNeg, (v) => s.updateSF(neg: v)),
        ]),
        _filterRow('日期', s.dEn, (v) => s.updateDF(en: v), [
          _dd(s.dOp, ['最近','早于'], ['lt','gt'], (v) => s.updateDF(op: v), 48),
          _stepper(s.dVal.toString(), (v) => s.updateDF(val: int.tryParse(v) ?? 7), 75, min: 1),
          _dd(s.dUnit, ['时','天','月'], ['hour','day','month'], (v) => s.updateDF(unit: v), 40),
          _neg(s.dNeg, (v) => s.updateDF(neg: v)),
        ]),
      ]))),
      const Divider(height: 24),
      Row(children: [
        const Text('💾 保存配置', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
        const SizedBox(width: 6),
        Text('${s.rules.length}/5', style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
      ]),
      const SizedBox(height: 6),
      _rules(ctx, s),
      const Divider(height: 24),
      Row(children: [
        const Text('🛠 工具', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
        const SizedBox(width: 4),
        Tooltip(message: '优先级最高', child: Container(decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(3)), padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1), child: const Text('!', style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.w700)))),
      ]),
      const SizedBox(height: 6),
      _tools(ctx, s),
    ]));
  }

  Widget _filterRow(String label, bool en, ValueChanged<bool> onEn, List<Widget> children, {bool compact = false}) =>
    Padding(padding: const EdgeInsets.only(bottom: 4), child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
      SizedBox(width: 18, child: Checkbox(visualDensity: VisualDensity.compact, value: en, onChanged: (v) => onEn(v ?? false))),
      const SizedBox(width: 4),
      Text(label, style: const TextStyle(fontSize: 12)),
      const SizedBox(width: 4),
      ...children,
    ]));

  Widget _dd(String val, List<String> labels, List<String> values, ValueChanged<String> cb, double w) =>
    Container(width: w, height: 26,
      margin: const EdgeInsets.only(right: 2),
      decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(4), color: Colors.white),
      padding: const EdgeInsets.only(left: 5, right: 1),
      child: DropdownButtonHideUnderline(child: DropdownButton<String>(
        value: val, isExpanded: true, isDense: true, iconSize: 14,
        style: const TextStyle(fontSize: 11, color: Colors.black87), iconEnabledColor: Colors.grey.shade600,
        dropdownColor: Colors.white,
        selectedItemBuilder: (ctx) => labels.map((l) => Container(alignment: Alignment.centerLeft, child: Text(l, style: const TextStyle(fontSize: 11, color: Colors.black87)))).toList(),
        items: List.generate(labels.length, (i) => DropdownMenuItem(value: values[i], child: Container(alignment: Alignment.centerLeft, height: 24, child: Text(labels[i], style: const TextStyle(fontSize: 11, color: Colors.black87))))),
        onChanged: (v) { if (v != null) cb(v); },
      )));

  Widget _tf(String val, String hint, ValueChanged<String> cb, double w) =>
    _TextFieldWrapper(val: val, hint: hint, cb: cb, w: w);

  Widget _nf(String val, ValueChanged<String> cb, double w) =>
    _TextFieldWrapper(val: val, cb: cb, w: w, isNumber: true);

  Widget _stepper(String val, ValueChanged<String> cb, double w, {double min = 0, double step = 1}) =>
    Container(width: w, height: 26, margin: const EdgeInsets.only(right: 2), decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(4)), child: Row(children: [
      _stepBtn('−', () { final n = double.tryParse(val); if (n != null && n > min) cb(_fmtNum(n - step)); }),
      Container(width: 1, color: Colors.grey.shade200),
      Expanded(child: _TextFieldWrapper(val: val, cb: cb, isNumber: true, stepper: true)),
      Container(width: 1, color: Colors.grey.shade200),
      _stepBtn('+', () { final n = double.tryParse(val); if (n != null) cb(_fmtNum(n + step)); }),
    ]));

  String _fmtNum(double n) => n == n.roundToDouble() ? n.round().toString() : n.toString();

  Widget _stepBtn(String label, VoidCallback onTap) =>
    SizedBox(width: 18, child: InkWell(
      onTap: onTap,
      child: Center(child: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w300, color: Colors.black54))),
    ));




  Widget _neg(bool v, ValueChanged<bool> cb) => Padding(padding: const EdgeInsets.only(left: 8), child: Row(mainAxisSize: MainAxisSize.min, children: [
    SizedBox(width: 14, child: Checkbox(visualDensity: VisualDensity.compact, value: v, onChanged: (x) => cb(x ?? false))),
    const SizedBox(width: 4),
    const Text('取反', style: TextStyle(fontSize: 10, color: Colors.grey)),
  ]));

  // ── 规则 ──
  Widget _rules(BuildContext ctx, FileService s) {
    final ctrl = TextEditingController();
    return Column(children: [
      Row(children: [
        Expanded(child: SizedBox(height: 32, child: TextField(controller: ctrl, decoration: const InputDecoration(hintText: '名称', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 4, vertical: 10), border: OutlineInputBorder()), style: const TextStyle(fontSize: 11)))),
        const SizedBox(width: 4),
        FilledButton(onPressed: () async {
          final n = ctrl.text.trim();
          if (n.isNotEmpty) {
            final ok = await s.saveRule(n);
            if (ok) {
              ctrl.clear();
            } else if (ctx.mounted) {
              showDialog(context: ctx, builder: (c) => AlertDialog(
                title: const Text('已达上限'),
                content: const Text('最多保存 5 条配置，请先删除一条再保存。'),
                actions: [FilledButton(onPressed: () => Navigator.pop(c), child: const Text('知道了'))],
              ));
            }
          }
        }, child: const Text('保存', style: TextStyle(fontSize: 11))),
      ]),
      const SizedBox(height: 4),
      ...s.rules.asMap().entries.map((e) => Row(children: [
        Expanded(child: Tooltip(message: '${e.value.name}  —  ${_summary(e.value)}', child: InkWell(onTap: () { s.applyRule(e.value); s.openPreview(); setState(() => dissolveMode = false); }, child: Text('${e.value.name}  —  ${_summary(e.value)}', style: const TextStyle(fontSize: 11), overflow: TextOverflow.ellipsis)))),
        FilledButton(onPressed: () { s.applyRule(e.value); s.openPreview(); setState(() => dissolveMode = false); }, style: FilledButton.styleFrom(minimumSize: Size.zero, padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0), textStyle: const TextStyle(fontSize: 10)), child: const Text('加载')),
        IconButton(icon: const Icon(Icons.close, size: 14), visualDensity: VisualDensity.compact, onPressed: () => s.deleteRule(e.key)),
      ])),
    ]);
  }

  String _summary(dynamic r) {
    final p = <String>[];
    if (r.nEn && r.nVal.isNotEmpty) p.add('名:${r.nVal}'); if (r.eEn && r.eVal.isNotEmpty) p.add('后缀:${r.eVal}');
    if (r.sEn) p.add('${r.sOp=="gt"?">":r.sOp=="lt"?"<":"="}${r.sVal}${r.sUnit}');
    if (r.dEn) p.add('${r.dOp=="lt"?"最近":"早于"}${r.dVal}${r.dUnit=="hour"?"时":r.dUnit=="day"?"天":"月"}');
    return p.isEmpty ? '无筛选' : p.join(' | ');
  }

  // ── 工具 ──
  Widget _tools(BuildContext ctx, FileService s) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    // 空文件夹行
    Row(children: [
      SizedBox(width: 18, child: Checkbox(visualDensity: VisualDensity.compact, value: emptyDirMode, onChanged: s.currentPath.isEmpty ? null : (v) => setState(() { emptyDirMode = v ?? false; if (emptyDirMode) dissolveMode = false; }))),
      const SizedBox(width: 2),
      const Text('空文件夹', style: TextStyle(fontSize: 12)),
    ]),
    const SizedBox(height: 4),
    // 解散行：勾选 + 标签 + 保留级别 + ?
    Row(children: [
      SizedBox(width: 18, child: Checkbox(visualDensity: VisualDensity.compact, value: dissolveMode, onChanged: s.currentPath.isEmpty && s.files.isEmpty ? null : (v) => setState(() { dissolveMode = v ?? false; if (dissolveMode) emptyDirMode = false; }))),
      const SizedBox(width: 2),
      const Text('解散文件夹', style: TextStyle(fontSize: 12)),
      const SizedBox(width: 8),
      const Text('保留', style: TextStyle(fontSize: 11)),
      const SizedBox(width: 4),
      _stepper(dissolveLevel.toString(), (v) { final n = int.tryParse(v); if (n != null && n >= 0) setState(() => dissolveLevel = n); }, 56, min: 0),
      const SizedBox(width: 2),
      const Text('级', style: TextStyle(fontSize: 11)),
      const SizedBox(width: 4),
      Tooltip(richMessage: const TextSpan(children: [TextSpan(text: '保留0级：a/b/1.txt → 根目录/1.txt\n'), TextSpan(text: '保留1级：a/b/c/1.txt → a/1.txt\n'), TextSpan(text: '保留2级：a/b/c/1.txt → a/b/1.txt')], style: TextStyle(fontSize: 11, color: Colors.white)), child: Container(decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(3)), padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1), child: const Text('?', style: TextStyle(color: Colors.grey, fontSize: 11)))),
    ]),

  ]);

  // ── 主区域 ──
  Widget _main(BuildContext ctx) {
    final s = ctx.watch<FileService>();
    if (s.currentPath.isEmpty) return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.folder_open, size: 48, color: Colors.grey), const SizedBox(height: 8), Text('拖入文件夹或点击上方按钮', style: TextStyle(color: Colors.grey.shade500))]));
    if (s.isLoading) return const Center(child: CircularProgressIndicator());

    final list = dissolveMode || s.showPreview ? s.files : s.files;
    final sorted = List<FileItem>.from(list);
    sorted.sort((a, b) {
      int cmp;
      switch (_sortBy) {
        case 'size': cmp = a.size.compareTo(b.size); break;
        case 'type': cmp = a.extension.compareTo(b.extension); break;
        case 'date': cmp = a.modifiedAt.compareTo(b.modifiedAt); break;
        default: cmp = a.path.compareTo(b.path);
      }
      return _sortAsc ? cmp : -cmp;
    });

    return Column(children: [
      Container(color: Colors.grey.shade100, padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6), child: Row(children: [
        SizedBox(width: 24, child: Checkbox(visualDensity: VisualDensity.compact, value: s.allSelected, onChanged: (_) => s.toggleSelectAll())),
        Expanded(flex: 4, child: _sortHeader('路径', 'path')),
        const SizedBox(width: 4),
        SizedBox(width: 80, child: _sortHeader('大小', 'size')),
        SizedBox(width: 48, child: _sortHeader('类型', 'type')),
        SizedBox(width: 120, child: _sortHeader('修改时间', 'date')),
        const SizedBox(width: 36),
      ])),
      Expanded(child: sorted.isEmpty ? Center(child: Text('没有文件', style: TextStyle(color: Colors.grey.shade500))) : ListView.builder(itemCount: sorted.length, itemBuilder: (_, i) => _fileRow(ctx, s, sorted[i]))),
      _bottomBar(ctx, s),
    ]);
  }

  Widget _sortHeader(String label, String key) => InkWell(onTap: () => setState(() { if (_sortBy == key) _sortAsc = !_sortAsc; else { _sortBy = key; _sortAsc = true; } }), child: Row(mainAxisSize: MainAxisSize.min, children: [
    Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
    Icon(_sortBy == key ? (_sortAsc ? Icons.arrow_upward : Icons.arrow_downward) : Icons.unfold_more, size: 14, color: _sortBy == key ? Colors.blue : Colors.grey),
  ]));

  Color _fileTypeColor(String ext) {
    switch (ext.toLowerCase()) {
      // 图片 — 每后缀不同色
      case 'jpg':  return const Color(0xFFE91E63); // 玫红
      case 'jpeg': return const Color(0xFFF06292); // 粉红
      case 'png':  return const Color(0xFF16A34A); // 绿
      case 'gif':  return const Color(0xFF4CAF50); // 浅绿
      case 'bmp':  return const Color(0xFF2E7D32); // 深绿
      case 'svg':  return const Color(0xFF00BCD4); // 青
      case 'webp': return const Color(0xFF26A69A); // 蓝绿
      // 视频
      case 'mp4':  return const Color(0xFF1565C0); // 深蓝
      case 'avi':  return const Color(0xFF1976D2); // 蓝
      case 'mkv':  return const Color(0xFF42A5F5); // 浅蓝
      case 'mov':  return const Color(0xFF2979FF); // 亮蓝
      case 'wmv':  return const Color(0xFF448AFF); // 天蓝
      // 音频
      case 'mp3':  return const Color(0xFF7B1FA2); // 紫
      case 'wav':  return const Color(0xFF9C27B0); // 亮紫
      case 'flac': return const Color(0xFFAB47BC); // 浅紫
      case 'aac':  return const Color(0xFFCE93D8); // 淡紫
      case 'ogg':  return const Color(0xFF8E24AA); // 深紫
      // 文档
      case 'pdf':  return const Color(0xFFD84315); // 红棕
      case 'doc':  return const Color(0xFF0277BD); // 文档蓝
      case 'docx': return const Color(0xFF0288D1); // 浅文档蓝
      case 'xls':  return const Color(0xFF00695C); // 表格绿
      case 'xlsx': return const Color(0xFF00897B); // 浅表格绿
      case 'ppt':  return const Color(0xFFBF360C); // 演示红
      case 'pptx': return const Color(0xFFD84315); // 浅演示红
      // 代码/文本
      case 'dart':  return const Color(0xFF00ACC1); // 青
      case 'js':    return const Color(0xFFFDD835); // 黄
      case 'ts':    return const Color(0xFF3178C6); // TS蓝
      case 'py':    return const Color(0xFF388E3C); // Py绿
      case 'java':  return const Color(0xFFF4511E); // 橙红
      case 'cpp':   return const Color(0xFF00599C); // C++蓝
      case 'html':  return const Color(0xFFE44D26); // HTML橙
      case 'css':   return const Color(0xFF264DE4); // CSS蓝
      case 'json':  return const Color(0xFF616161); // 灰
      // 压缩包
      case 'zip':  return const Color(0xFF795548);  // 棕
      case 'rar':  return const Color(0xFF8D6E63);  // 浅棕
      case '7z':   return const Color(0xFFA1887F);  // 更浅棕
      case 'tar':  return const Color(0xFF6D4C41);  // 深棕
      case 'gz':   return const Color(0xFFBCAAA4);  // 淡棕
      // 可执行
      case 'exe':  return const Color(0xFFC62828); // 深红
      case 'dll':  return const Color(0xFFE53935); // 红
      // 纯文本
      case 'txt':  return const Color(0xFF757575); // 深灰
      case 'md':   return const Color(0xFF9E9E9E); // 中灰
      case 'log':  return const Color(0xFF9E9E9E); // 灰
      // 数据库
      case 'db':     return const Color(0xFF00838F); // 深青
      case 'sqlite': return const Color(0xFF0097A7); // 青蓝
      case 'sql':    return const Color(0xFF00ACC1); // 青
      // 其他常见
      case 'xml':  return const Color(0xFFFF7043); // 橙
      case 'yaml': case 'yml': return const Color(0xFFE53935); // 红
      case 'sh':   case 'bat': case 'ps1': return const Color(0xFF43A047); // 脚本绿
      default: return const Color(0xFF78909C); // 蓝灰(兜底)
    }
  }

  Widget _fileRow(BuildContext ctx, FileService s, FileItem f) {
    final sel = s.selectedPaths.contains(f.path);
    final extColor = _fileTypeColor(f.extension);
    return InkWell(onTap: () => s.toggleSelect(f.path), child: Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4), color: sel ? Colors.blue.shade50 : null, child: Row(children: [
      SizedBox(width: 24, child: Checkbox(visualDensity: VisualDensity.compact, value: sel, onChanged: (_) => s.toggleSelect(f.path))),
      Expanded(flex: 4, child: Tooltip(message: f.path, child: Text(f.path, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12)))),
      const SizedBox(width: 4),
      SizedBox(width: 80, child: Text(FileItem.formatSize(f.size), style: TextStyle(fontSize: 11, color: Colors.grey.shade600))),
      SizedBox(width: 48, child: Container(decoration: BoxDecoration(color: extColor, borderRadius: BorderRadius.circular(3)), padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 2), alignment: Alignment.center, child: Text(f.extension.isNotEmpty ? f.extension : '-', style: const TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.w600)))),
      const SizedBox(width: 4),
      SizedBox(width: 120, child: Text('${f.modifiedAt.year}-${f.modifiedAt.month.toString().padLeft(2, '0')}-${f.modifiedAt.day.toString().padLeft(2, '0')} ${f.modifiedAt.hour.toString().padLeft(2, '0')}:${f.modifiedAt.minute.toString().padLeft(2, '0')}', style: TextStyle(fontSize: 11, color: Colors.grey.shade600))),
      const SizedBox(width: 4),
      Tooltip(message: '打开位置', child: InkWell(onTap: () { Process.run('explorer', ['/select,', '${s.currentPath}\\${f.path.replaceAll('/', '\\')}']); }, child: Padding(padding: const EdgeInsets.all(4), child: Icon(Icons.folder, size: 16, color: Colors.grey.shade500)))),
    ])));
  }

  // ── 底部操作栏 ──
  Widget _bottomBar(BuildContext ctx, FileService s) => Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Colors.grey.shade200))), child: Row(children: [
    if (dissolveMode)
      Text('解散模式', style: TextStyle(fontSize: 11, color: Colors.orange))
    else if (emptyDirMode)
      Text('空文件夹模式', style: TextStyle(fontSize: 11, color: Colors.orange))
    else ...[
      Text('${s.selectedPaths.length} 选中', style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
      Text(' | ', style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
      Text('${s.filteredCount} 筛选', style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
      Text(' | ', style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
      Text('${s.totalCount} 总数', style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
    ],
    const Spacer(),
    if (dissolveMode)
      FilledButton.icon(onPressed: () => _dissolvePreview(ctx, s), icon: const Icon(Icons.preview, size: 14), label: const Text('解散预览', style: TextStyle(fontSize: 11)), style: FilledButton.styleFrom(backgroundColor: Colors.orange.shade100, foregroundColor: Colors.orange.shade900))
    else if (emptyDirMode)
      FilledButton.icon(onPressed: () => _emptyDirScan(ctx, s), icon: const Icon(Icons.folder_delete, size: 14), label: const Text('查找空文件夹', style: TextStyle(fontSize: 11)), style: FilledButton.styleFrom(backgroundColor: Colors.orange.shade100, foregroundColor: Colors.orange.shade900))
    else ...[
      FilledButton.icon(onPressed: s.currentPath.isNotEmpty ? () async => await s.togglePreview() : null, icon: const Icon(Icons.play_arrow, size: 14), label: const Text('预览匹配', style: TextStyle(fontSize: 11)), style: s.showPreview ? FilledButton.styleFrom(backgroundColor: Colors.blue.shade100, foregroundColor: Colors.blue) : FilledButton.styleFrom()),
      const SizedBox(width: 8),
      FilledButton.icon(onPressed: s.someSelected ? () async {
        final ok = await showDialog<bool>(context: ctx, builder: (c) => AlertDialog(title: const Text('确认删除'), content: Text('删除 ${s.selectedPaths.length} 个文件？不可撤销！'), actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('取消')), FilledButton(onPressed: () => Navigator.pop(c, true), style: FilledButton.styleFrom(backgroundColor: Colors.red), child: const Text('删除'))]));
        if (ok == true) s.deleteFiles(s.selectedPaths.toList());
      } : null, icon: const Icon(Icons.close, size: 14), label: const Text('删除选中', style: TextStyle(fontSize: 11)), style: FilledButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white)),
    ],
  ]));

  // ── 解散预览弹窗 ──
  void _dissolvePreview(BuildContext ctx, FileService s) {
    final changes = s.previewDissolve(dissolveLevel);
    if (changes.isEmpty) { ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text('没有需要解散的文件（当前保留$dissolveLevel级）'))); return; }
    showDialog(context: ctx, builder: (c) => AlertDialog(
      title: Text('解散预览 — ${changes.length} 个文件将移动'),
      content: SizedBox(width: 600, height: 400, child: SingleChildScrollView(child: Table(
        border: TableBorder.all(color: Colors.grey.shade200),
        columnWidths: const {0: FlexColumnWidth(1), 1: FlexColumnWidth(1)},
        children: [
          TableRow(children: [Container(padding: const EdgeInsets.all(6), color: Colors.grey.shade100, child: const Text('原路径', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 11))), Container(padding: const EdgeInsets.all(6), color: Colors.grey.shade100, child: const Text('新路径', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 11)))]),
          ...changes.entries.map((e) => TableRow(children: [Padding(padding: const EdgeInsets.all(4), child: Text(e.key, style: const TextStyle(fontSize: 11))), Padding(padding: const EdgeInsets.all(4), child: Text(e.value, style: TextStyle(fontSize: 11, color: Colors.green.shade700)))])),
        ],
      ))),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c), child: const Text('取消')),
        FilledButton(onPressed: () { Navigator.pop(c); s.dissolveFolder(dissolveLevel); setState(() => dissolveMode = false); }, style: FilledButton.styleFrom(backgroundColor: Colors.orange), child: const Text('确认解散')),
      ],
    ));
  }

  // ── 空文件夹扫描 ──
  void _emptyDirScan(BuildContext ctx, FileService s) async {
    final dirs = await s.findEmptyDirs();
    if (!ctx.mounted) return;
    if (dirs.isEmpty) {
      ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(content: Text('没有空文件夹')));
      return;
    }
    final ok = await showDialog<bool>(context: ctx, builder: (c) => AlertDialog(
      title: Text('空文件夹 — ${dirs.length} 个'),
      content: SizedBox(width: 500, height: 300, child: SingleChildScrollView(
        child: Table(border: TableBorder.all(color: Colors.grey.shade200), columnWidths: const {0: FlexColumnWidth(3), 1: FlexColumnWidth(1)}, children: [
          TableRow(children: [Container(padding: const EdgeInsets.all(6), color: Colors.grey.shade100, child: const Text('路径', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 11))), Container(padding: const EdgeInsets.all(6), color: Colors.grey.shade100, child: const Text('状态', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 11)))]),
          ...dirs.map((d) => TableRow(children: [Padding(padding: const EdgeInsets.all(4), child: Text(d, style: const TextStyle(fontSize: 11))), const Padding(padding: EdgeInsets.all(4), child: Text('空', style: TextStyle(fontSize: 11, color: Colors.red)))])),
        ]),
      )),
      actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('取消')), FilledButton(onPressed: () => Navigator.pop(c, true), style: FilledButton.styleFrom(backgroundColor: Colors.red), child: const Text('确认删除'))],
    ));
    if (ok == true) { await s.deleteEmptyDirs(dirs); setState(() => emptyDirMode = false); }
  }
}

// ── 不会反字的输入框 Wrapper ──
class _TextFieldWrapper extends StatefulWidget {
  final String val; final String? hint; final ValueChanged<String> cb;
  final double w; final bool isNumber; final bool stepper;
  const _TextFieldWrapper({required this.val, this.hint, required this.cb, this.w = 56, this.isNumber = false, this.stepper = false, super.key});

  @override State<_TextFieldWrapper> createState() => _TextFieldWrapperState();
}

class _TextFieldWrapperState extends State<_TextFieldWrapper> {
  late TextEditingController _ctrl;
  bool _skip = false;

  @override void initState() { super.initState(); _ctrl = TextEditingController(text: widget.val); }
  @override void dispose() { _ctrl.dispose(); super.dispose(); }
  @override void didUpdateWidget(covariant _TextFieldWrapper old) {
    super.didUpdateWidget(old);
    if (!_skip && old.val != widget.val && _ctrl.text != widget.val) {
      _skip = true; _ctrl.text = widget.val; _skip = false;
    }
  }

  @override Widget build(BuildContext ctx) {
    final hasBorder = !widget.stepper;
    return SizedBox(width: widget.w, child: TextField(
      controller: _ctrl, textDirection: TextDirection.ltr,
      keyboardType: widget.isNumber ? TextInputType.number : TextInputType.text,
      textAlign: widget.isNumber && !widget.stepper ? TextAlign.center : TextAlign.start,
      decoration: InputDecoration(
        hintText: widget.hint, isDense: true,
        contentPadding: EdgeInsets.symmetric(horizontal: widget.stepper ? 2 : 5, vertical: 5),
        border: hasBorder ? const OutlineInputBorder() : InputBorder.none,
        enabledBorder: hasBorder ? const OutlineInputBorder() : InputBorder.none,
        focusedBorder: hasBorder ? OutlineInputBorder(borderSide: BorderSide(color: Colors.blue.shade300)) : InputBorder.none,
      ),
      style: const TextStyle(fontSize: 11),
      onChanged: (v) { _skip = true; widget.cb(v); _skip = false; },
    ));
  }
}
