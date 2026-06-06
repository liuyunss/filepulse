import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/file_service.dart';

class ScanPanel extends StatefulWidget {
  const ScanPanel({super.key});

  @override
  State<ScanPanel> createState() => _ScanPanelState();
}

class _ScanPanelState extends State<ScanPanel> {
  final _pathController = TextEditingController();

  @override
  void dispose() {
    _pathController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<FileService>(
      builder: (context, service, child) {
        return Card(
          margin: const EdgeInsets.all(12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.folder, size: 20),
                    const SizedBox(width: 8),
                    const Text('扫描路径',
                        style: TextStyle(fontWeight: FontWeight.bold)),
                    const Spacer(),
                    if (service.currentPath.isNotEmpty)
                      Flexible(
                        child: Text(
                          service.currentPath,
                          style: Theme.of(context).textTheme.bodySmall,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _pathController,
                        decoration: InputDecoration(
                          hintText: '输入文件夹路径...',
                          border: const OutlineInputBorder(),
                          isDense: true,
                          suffixIcon: IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () => _pathController.clear(),
                          ),
                        ),
                        onSubmitted: (value) {
                          if (value.isNotEmpty) {
                            service.scanFolder(value);
                          }
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    FilledButton.icon(
                      onPressed: service.isLoading
                          ? null
                          : () {
                              final path = _pathController.text.trim();
                              if (path.isNotEmpty) {
                                service.scanFolder(path);
                              }
                            },
                      icon: service.isLoading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.search, size: 18),
                      label: Text(service.isLoading ? '扫描中...' : '扫描'),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
                if (service.error != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    service.error!,
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
