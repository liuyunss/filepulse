import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/file_service.dart';
import '../models/file_item.dart';

class AdvancedPanel extends StatefulWidget {
  const AdvancedPanel({super.key});

  @override
  State<AdvancedPanel> createState() => _AdvancedPanelState();
}

class _AdvancedPanelState extends State<AdvancedPanel> {
  int _keepLevels = 1;
  late TextEditingController _threadController;
  late TextEditingController _emptyExtController;

  @override
  void initState() {
    super.initState();
    _threadController = TextEditingController();
    _emptyExtController = TextEditingController();
  }

  @override
  void dispose() {
    _threadController.dispose();
    _emptyExtController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<FileService>(
      builder: (context, service, child) {
        if (!service.showAdvancedPanel) return const SizedBox.shrink();

        // 同步 controller 文本（仅在文本不同时更新，避免光标跳动）
        final threadText = service.threadCount.toString();
        if (_threadController.text != threadText) {
          _threadController.text = threadText;
        }
        final extText = service.emptyExtFilter;
        if (_emptyExtController.text != extText) {
          _emptyExtController.text = extText;
        }

        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('高级功能',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),

                // 功能入口按钮
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    OutlinedButton.icon(
                      onPressed: () => service.detectDuplicates(),
                      icon: const Icon(Icons.content_copy, size: 18),
                      label: const Text('重复检测'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => service.scanEmptyFiles(),
                      icon: const Icon(Icons.note_add, size: 18),
                      label: const Text('空文件清理'),
                    ),
                  ],
                ),

                // 线程数配置
                const SizedBox(height: 12),
                _buildThreadConfig(context, service),

                // 解散文件夹
                const SizedBox(height: 12),
                _buildDissolveSection(context, service),

                // 重复文件检测结果
                if (service.showDupPanel) ...[
                  const SizedBox(height: 12),
                  _buildDupDetectSection(context, service),
                ],

                // 空文件清理结果
                if (service.showEmptyCleanupPanel) ...[
                  const SizedBox(height: 12),
                  _buildEmptyCleanupSection(context, service),
                ],

                // 规则管理
                const Divider(height: 24),
                _buildRulesSection(context, service),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildThreadConfig(BuildContext context, FileService service) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          const Icon(Icons.settings, size: 18),
          const SizedBox(width: 8),
          const Text('扫描线程数'),
          const SizedBox(width: 8),
          SizedBox(
            width: 60,
            child: TextField(
              controller: _threadController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                isDense: true,
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                border: OutlineInputBorder(),
              ),
              onSubmitted: (v) {
                final n = int.tryParse(v);
                if (n != null) service.updateThreadCount(n);
              },
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '（默认 4 核）',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }

  Widget _buildDissolveSection(BuildContext context, FileService service) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          const Icon(Icons.drive_file_move, size: 18),
          const SizedBox(width: 8),
          const Text('解散文件夹'),
          const SizedBox(width: 8),
          const Text('保留'),
          const SizedBox(width: 4),
          DropdownButton<int>(
            value: _keepLevels,
            isDense: true,
            items: const [
              DropdownMenuItem(value: 0, child: Text('0')),
              DropdownMenuItem(value: 1, child: Text('1')),
              DropdownMenuItem(value: 2, child: Text('2')),
              DropdownMenuItem(value: 3, child: Text('3')),
            ],
            onChanged: (v) {
              if (v != null) setState(() => _keepLevels = v);
            },
          ),
          const SizedBox(width: 4),
          const Text('级'),
          const Spacer(),
          OutlinedButton(
            onPressed: service.currentPath.isNotEmpty
                ? () => service.dissolveFolder(service.currentPath, _keepLevels)
                : null,
            child: const Text('执行解散'),
          ),
        ],
      ),
    );
  }

  Widget _buildDupDetectSection(BuildContext context, FileService service) {
    final groups = service.duplicateGroups;
    final totalDupFiles =
        groups.fold<int>(0, (sum, g) => sum + g.length);
    final totalDupSize = groups.fold<int>(
        0, (sum, g) => sum + g[0].size * (g.length - 1));

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.tertiaryContainer,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: Theme.of(context).colorScheme.tertiary,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.content_copy, size: 18),
              const SizedBox(width: 8),
              const Text('重复文件检测',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.close, size: 18),
                onPressed: () => service.toggleDupPanel(),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (groups.isEmpty)
            const Text('未发现重复文件')
          else ...[
            Text(
              '发现 ${groups.length} 组重复文件，共 $totalDupFiles 个，可释放约 ${FileItem.formatSize(totalDupSize)}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 8),
            ...groups.map((group) => _buildDupGroup(context, group)),
          ],
        ],
      ),
    );
  }

  Widget _buildDupGroup(BuildContext context, List<FileItem> group) {
    return ExpansionTile(
      tilePadding: EdgeInsets.zero,
      title: Text(
        '${group[0].name} × ${group.length} (${group[0].sizeFormatted})',
        style: const TextStyle(fontSize: 13),
      ),
      children: group.map((f) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(
            children: [
              const Icon(Icons.insert_drive_file,
                  size: 16, color: Colors.blue),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(f.name, style: const TextStyle(fontSize: 13)),
                    Text(f.path,
                        style: TextStyle(
                            fontSize: 11, color: Colors.grey.shade500)),
                  ],
                ),
              ),
              Text(f.sizeFormatted,
                  style: const TextStyle(fontSize: 12)),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildEmptyCleanupSection(
      BuildContext context, FileService service) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.secondaryContainer,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: Theme.of(context).colorScheme.secondary,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.note_add, size: 18),
              const SizedBox(width: 8),
              const Text('空文件清理',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.close, size: 18),
                onPressed: () => service.toggleEmptyCleanupPanel(),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              const Text('后缀筛选:'),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _emptyExtController,
                  decoration: const InputDecoration(
                    hintText: '.txt,.log,.tmp',
                    isDense: true,
                    border: OutlineInputBorder(),
                  ),
                  onChanged: (v) => service.updateEmptyExtFilter(v),
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: () => service.scanEmptyFiles(),
                child: const Text('扫描'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (service.emptyFiles.isEmpty)
            const Text('未找到符合条件的空文件')
          else ...[
            Text(
              '找到 ${service.emptyFiles.length} 个空文件',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 8),
            ...service.emptyFiles.map((f) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    children: [
                      const Icon(Icons.insert_drive_file,
                          size: 16, color: Colors.orange),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(f.name,
                                style: const TextStyle(fontSize: 13)),
                            Text(f.path,
                                style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.grey.shade500)),
                          ],
                        ),
                      ),
                    ],
                  ),
                )),
          ],
        ],
      ),
    );
  }

  Widget _buildRulesSection(BuildContext context, FileService service) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('已保存的规则',
            style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        if (service.savedRules.isEmpty)
          Text('暂无规则',
              style: TextStyle(
                  color: Colors.grey.shade500, fontSize: 13))
        else
          ...service.savedRules.asMap().entries.map((entry) {
            final i = entry.key;
            final rule = entry.value;
            return ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.label, size: 18),
              title: Text(rule.name, style: const TextStyle(fontSize: 14)),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextButton(
                    onPressed: () {
                      service.applyRule(rule);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('已应用规则: ${rule.name}')),
                      );
                    },
                    child: const Text('应用'),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline, size: 18),
                    onPressed: () => service.deleteRule(i),
                  ),
                ],
              ),
            );
          }),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () => _saveRuleDialog(context, service),
          icon: const Icon(Icons.save, size: 18),
          label: const Text('保存当前条件为规则'),
        ),
      ],
    );
  }

  void _saveRuleDialog(BuildContext context, FileService service) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('保存规则'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            hintText: '请输入规则名称',
            border: OutlineInputBorder(),
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () {
              final name = controller.text.trim();
              if (name.isNotEmpty) {
                service.saveRule(name);
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('规则 "$name" 已保存')),
                );
              }
            },
            child: const Text('保存'),
          ),
        ],
      ),
    );
  }
}
