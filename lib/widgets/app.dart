import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/file_service.dart';
import 'scan_panel.dart';
import 'filter_panel.dart';
import 'file_table.dart';
import 'advanced_panel.dart';

class FilePulseApp extends StatelessWidget {
  const FilePulseApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '文件脉搏 FilePulse',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF6B7280),
        brightness: Brightness.light,
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF6B7280),
        brightness: Brightness.dark,
      ),
      themeMode: ThemeMode.system,
      home: const MainScreen(),
    );
  }
}

class MainScreen extends StatelessWidget {
  const MainScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.speed, size: 28),
            SizedBox(width: 8),
            Text('文件脉搏'),
          ],
        ),
        centerTitle: false,
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 900),
          child: Column(
            children: [
              // 扫描面板
              const ScanPanel(),
              // 筛选面板
              const FilterPanel(),
              // 高级面板
              const AdvancedPanel(),
              // 文件列表
              const Expanded(child: FileTable()),
              // 底部操作栏
              const _BottomActionBar(),
            ],
          ),
        ),
      ),
    );
  }
}

class _BottomActionBar extends StatelessWidget {
  const _BottomActionBar();

  @override
  Widget build(BuildContext context) {
    return Consumer<FileService>(
      builder: (context, service, child) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            border: Border(
              top: BorderSide(
                color: Theme.of(context).colorScheme.outlineVariant,
              ),
            ),
          ),
          child: Row(
            children: [
              // 扫描按钮
              FilledButton.icon(
                onPressed: service.currentPath.isNotEmpty && !service.isLoading
                    ? () => service.scanFolder(service.currentPath)
                    : null,
                icon: const Icon(Icons.search, size: 18),
                label: const Text('扫描'),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.grey.shade600,
                ),
              ),
              const SizedBox(width: 8),
              // 高级按钮
              OutlinedButton.icon(
                onPressed: () => service.toggleAdvancedPanel(),
                icon: Icon(
                  service.showAdvancedPanel
                      ? Icons.expand_less
                      : Icons.expand_more,
                  size: 18,
                ),
                label: const Text('高级'),
              ),
              const Spacer(),
              // 统计信息
              if (service.currentPath.isNotEmpty)
                Text(
                  '共 ${service.totalCount} 项，显示 ${service.filteredCount} 项',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              const SizedBox(width: 12),
              // 删除按钮
              if (service.someSelected)
                FilledButton.icon(
                  onPressed: () => _confirmDelete(context, service),
                  icon: const Icon(Icons.delete_forever, size: 18),
                  label: Text('删除 (${service.selectedPaths.length})'),
                  style: FilledButton.styleFrom(
                    backgroundColor: Theme.of(context).colorScheme.error,
                    foregroundColor: Theme.of(context).colorScheme.onError,
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  void _confirmDelete(BuildContext context, FileService service) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('确认删除'),
        content: Text('确定删除选中的 ${service.selectedPaths.length} 个文件？\n此操作不可撤销。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              service.deleteFiles(service.selectedPaths.toList());
            },
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            child: const Text('删除'),
          ),
        ],
      ),
    );
  }
}
