import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/file_service.dart';

class FilterPanel extends StatelessWidget {
  const FilterPanel({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<FileService>(
      builder: (context, service, child) {
        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 12),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.filter_list, size: 20),
                    const SizedBox(width: 8),
                    const Text('筛选条件',
                        style: TextStyle(fontWeight: FontWeight.bold)),
                    const Spacer(),
                    Text(
                      '显示 ${service.filteredCount} / ${service.totalCount} 项',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                // 名称筛选
                _buildNameFilter(context, service),
                const SizedBox(height: 8),
                // 其他筛选条件
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _buildSizeFilter(context, service),
                    _buildExtFilter(context, service),
                    _buildDateFilter(context, service),
                    _buildEmptyFilter(context, service),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildNameFilter(BuildContext context, FileService service) {
    return Row(
      children: [
        SizedBox(
          width: 20,
          child: Checkbox(
            value: service.nameFilterEnabled,
            onChanged: (v) => service.updateNameFilter(enabled: v ?? false),
          ),
        ),
        const Text('名称', style: TextStyle(fontSize: 13)),
        const SizedBox(width: 8),
        // 操作符下拉
        SizedBox(
          width: 80,
          child: DropdownButtonFormField<String>(
            value: service.nameOperator,
            isDense: true,
            decoration: const InputDecoration(
              isDense: true,
              contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              border: OutlineInputBorder(),
            ),
            items: const [
              DropdownMenuItem(value: 'contains', child: Text('包含')),
              DropdownMenuItem(value: 'prefix', child: Text('前缀')),
              DropdownMenuItem(value: 'suffix', child: Text('后缀')),
            ],
            onChanged: (v) => service.updateNameFilter(op: v),
          ),
        ),
        const SizedBox(width: 8),
        // 关键词输入
        SizedBox(
          width: 150,
          child: TextField(
            decoration: const InputDecoration(
              hintText: '关键词',
              isDense: true,
              contentPadding:
                  EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              border: OutlineInputBorder(),
            ),
            onChanged: (v) => service.updateNameFilter(value: v),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 20,
          child: Checkbox(
            value: service.nameNegate,
            onChanged: (v) => service.updateNameFilter(negate: v ?? false),
          ),
        ),
        const Text('取反', style: TextStyle(fontSize: 12)),
      ],
    );
  }

  Widget _buildSizeFilter(BuildContext context, FileService service) {
    return FilterChip(
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            service.sizeNegate ? Icons.not_interested : Icons.check_circle,
            size: 16,
            color: service.sizeFilterEnabled ? Colors.blue : null,
          ),
          const SizedBox(width: 4),
          Text(service.sizeFilterEnabled
              ? '${service.sizeOperator == 'gt' ? '>' : service.sizeOperator == 'lt' ? '<' : '='} ${service.sizeValue} ${service.sizeUnit}'
              : '大小'),
        ],
      ),
      selected: service.sizeFilterEnabled,
      onSelected: (selected) =>
          service.updateSizeFilter(enabled: selected),
    );
  }

  Widget _buildExtFilter(BuildContext context, FileService service) {
    return FilterChip(
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            service.extNegate ? Icons.not_interested : Icons.check_circle,
            size: 16,
            color: service.extFilterEnabled ? Colors.blue : null,
          ),
          const SizedBox(width: 4),
          Text(service.extFilterEnabled
              ? '.${service.extValue}'
              : '后缀'),
        ],
      ),
      selected: service.extFilterEnabled,
      onSelected: (selected) =>
          service.updateExtFilter(enabled: selected),
    );
  }

  Widget _buildDateFilter(BuildContext context, FileService service) {
    return FilterChip(
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            service.dateNegate ? Icons.not_interested : Icons.check_circle,
            size: 16,
            color: service.dateFilterEnabled ? Colors.blue : null,
          ),
          const SizedBox(width: 4),
          Text(service.dateFilterEnabled
              ? '近${service.dateValue}天内'
              : '日期'),
        ],
      ),
      selected: service.dateFilterEnabled,
      onSelected: (selected) =>
          service.updateDateFilter(enabled: selected),
    );
  }

  Widget _buildEmptyFilter(BuildContext context, FileService service) {
    return FilterChip(
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            service.emptyNegate ? Icons.not_interested : Icons.check_circle,
            size: 16,
            color: service.emptyFilterEnabled ? Colors.blue : null,
          ),
          const SizedBox(width: 4),
          const Text('空文件夹'),
        ],
      ),
      selected: service.emptyFilterEnabled,
      onSelected: (selected) =>
          service.updateEmptyFilter(enabled: selected),
    );
  }
}
