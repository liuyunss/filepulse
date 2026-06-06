import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/file_service.dart';
import '../models/file_item.dart';

class FileTable extends StatefulWidget {
  const FileTable({super.key});

  @override
  State<FileTable> createState() => _FileTableState();
}

class _FileTableState extends State<FileTable> {
  String _sortColumn = 'name';
  bool _sortAscending = true;

  @override
  Widget build(BuildContext context) {
    return Consumer<FileService>(
      builder: (context, service, child) {
        if (service.currentPath.isEmpty) {
          return const Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.folder_open, size: 64, color: Colors.grey),
                SizedBox(height: 16),
                Text('输入文件夹路径开始分析',
                    style: TextStyle(color: Colors.grey)),
              ],
            ),
          );
        }

        if (service.isLoading) {
          return const Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                CircularProgressIndicator(),
                SizedBox(height: 16),
                Text('扫描中...'),
              ],
            ),
          );
        }

        final files = List<FileItem>.from(service.files);
        // 空结果提示
        if (files.isEmpty && service.currentPath.isNotEmpty && !service.isLoading) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.search_off, size: 64, color: Colors.grey),
                SizedBox(height: 16),
                Text('没有匹配的文件', style: TextStyle(color: Colors.grey, fontSize: 16)),
                SizedBox(height: 8),
                Text('请调整筛选条件', style: TextStyle(color: Colors.grey.shade400, fontSize: 13)),
              ],
            ),
          );
        }
        files.sort((a, b) {
          int cmp;
          switch (_sortColumn) {
            case 'size':
              cmp = a.size.compareTo(b.size);
              break;
            case 'date':
              cmp = a.modifiedAt.compareTo(b.modifiedAt);
              break;
            case 'type':
              cmp = a.extension.compareTo(b.extension);
              break;
            case 'path':
              cmp = a.path.compareTo(b.path);
              break;
            default:
              cmp = a.name.compareTo(b.name);
          }
          return _sortAscending ? cmp : -cmp;
        });

        return Column(
          children: [
            // 选中操作栏
            if (service.someSelected)
              _buildActionBar(context, service),
            // 表格
            Expanded(
              child: Card(
                margin: const EdgeInsets.symmetric(horizontal: 12),
                clipBehavior: Clip.antiAlias,
                child: SingleChildScrollView(
                  child: SizedBox(
                    width: double.infinity,
                    child: DataTable(
                      headingRowColor: WidgetStateProperty.all(
                        Theme.of(context)
                            .colorScheme
                            .surfaceContainerHighest,
                      ),
                      columns: [
                        // 全选 checkbox
                        DataColumn(
                          headingRowAlignment: null,
                          label: Checkbox(
                            value: service.allSelected,
                            onChanged: (_) => service.toggleSelectAll(),
                          ),
                        ),
                        _buildDataColumn('文件名', 'name'),
                        _buildDataColumn('大小', 'size'),
                        _buildDataColumn('类型', 'type'),
                        _buildDataColumn('修改时间', 'date'),
                        _buildDataColumn('路径', 'path'),
                      ],
                      rows: files.map((file) {
                        final isSelected =
                            service.selectedPaths.contains(file.path);
                        return DataRow(
                          selected: isSelected,
                          onSelectChanged: (_) =>
                              service.toggleSelect(file.path),
                          cells: [
                            DataCell(
                              Checkbox(
                                value: isSelected,
                                onChanged: (_) =>
                                    service.toggleSelect(file.path),
                              ),
                            ),
                            DataCell(
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    file.isDirectory
                                        ? Icons.folder
                                        : Icons.insert_drive_file,
                                    color: file.isDirectory
                                        ? Colors.amber
                                        : Colors.blue,
                                    size: 20,
                                  ),
                                  const SizedBox(width: 8),
                                  Flexible(
                                    child: Text(
                                      file.name,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            DataCell(Text(file.sizeFormatted)),
                            DataCell(Text(
                              file.isDirectory ? '文件夹' : file.extension,
                              style: TextStyle(
                                color: Colors.grey.shade600,
                                fontSize: 13,
                              ),
                            )),
                            DataCell(Text(
                              '${file.modifiedAt.year}-'
                              '${file.modifiedAt.month.toString().padLeft(2, '0')}-'
                              '${file.modifiedAt.day.toString().padLeft(2, '0')}',
                              style: const TextStyle(fontSize: 13),
                            )),
                            DataCell(
                              Tooltip(
                                message: file.path,
                                child: Text(
                                  file.parentPath,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: Colors.grey.shade500,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        );
                      }).toList(),
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildActionBar(BuildContext context, FileService service) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      color: Theme.of(context).colorScheme.primaryContainer,
      child: Row(
        children: [
          Text(
            '已选择 ${service.selectedPaths.length} 项',
            style: TextStyle(
              color: Theme.of(context).colorScheme.onPrimaryContainer,
            ),
          ),
          const Spacer(),
          TextButton.icon(
            onPressed: () => service.clearSelection(),
            icon: const Icon(Icons.clear_all, size: 16),
            label: const Text('清空选择'),
          ),
        ],
      ),
    );
  }

  DataColumn _buildDataColumn(String label, String column) {
    return DataColumn(
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: const TextStyle(fontSize: 13)),
          if (_sortColumn == column)
            Icon(
              _sortAscending ? Icons.arrow_upward : Icons.arrow_downward,
              size: 14,
            ),
        ],
      ),
      onSort: (columnIndex, ascending) {
        setState(() {
          _sortColumn = column;
          _sortAscending = ascending;
        });
      },
    );
  }
}
