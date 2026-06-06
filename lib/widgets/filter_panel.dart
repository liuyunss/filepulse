import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/file_service.dart';

class FilterPanel extends StatefulWidget {
  const FilterPanel({super.key});

  @override
  State<FilterPanel> createState() => _FilterPanelState();
}

class _FilterPanelState extends State<FilterPanel> {
  Timer? _nameDebounce;

  @override
  void dispose() {
    _nameDebounce?.cancel();
    super.dispose();
  }

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
            onChanged: (v) {
              _nameDebounce?.cancel();
              _nameDebounce = Timer(const Duration(milliseconds: 300), () {
                service.updateNameFilter(value: v);
              });
            },
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
      onSelected: (selected) {
        if (selected && !service.sizeFilterEnabled) {
          // 首次启用：直接开启
          service.updateSizeFilter(enabled: true);
        } else if (service.sizeFilterEnabled) {
          // 已启用：打开配置对话框
          _showSizeFilterDialog(context, service);
        } else {
          service.updateSizeFilter(enabled: false);
        }
      },
    );
  }

  void _showSizeFilterDialog(BuildContext context, FileService service) {
    showDialog(
      context: context,
      builder: (ctx) => _SizeFilterDialog(service: service),
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
      onSelected: (selected) {
        if (selected && !service.extFilterEnabled) {
          service.updateExtFilter(enabled: true);
        } else if (service.extFilterEnabled) {
          _showExtFilterDialog(context, service);
        } else {
          service.updateExtFilter(enabled: false);
        }
      },
    );
  }

  void _showExtFilterDialog(BuildContext context, FileService service) {
    showDialog(
      context: context,
      builder: (ctx) => _ExtFilterDialog(service: service),
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
      onSelected: (selected) {
        if (selected && !service.dateFilterEnabled) {
          service.updateDateFilter(enabled: true);
        } else if (service.dateFilterEnabled) {
          _showDateFilterDialog(context, service);
        } else {
          service.updateDateFilter(enabled: false);
        }
      },
    );
  }

  void _showDateFilterDialog(BuildContext context, FileService service) {
    showDialog(
      context: context,
      builder: (ctx) => _DateFilterDialog(service: service),
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

// ─── 大小筛选对话框 ────────────────────────────────────────

class _SizeFilterDialog extends StatefulWidget {
  final FileService service;
  const _SizeFilterDialog({required this.service});

  @override
  State<_SizeFilterDialog> createState() => _SizeFilterDialogState();
}

class _SizeFilterDialogState extends State<_SizeFilterDialog> {
  late String _operator;
  late TextEditingController _valueController;
  late String _unit;
  late bool _negate;

  @override
  void initState() {
    super.initState();
    _operator = widget.service.sizeOperator;
    _valueController = TextEditingController(
      text: widget.service.sizeValue.toString(),
    );
    _unit = widget.service.sizeUnit;
    _negate = widget.service.sizeNegate;
  }

  @override
  void dispose() {
    _valueController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('大小筛选'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              // 操作符
              SizedBox(
                width: 70,
                child: DropdownButtonFormField<String>(
                  value: _operator,
                  isDense: true,
                  decoration: const InputDecoration(
                    isDense: true,
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'gt', child: Text('大于 >')),
                    DropdownMenuItem(value: 'lt', child: Text('小于 <')),
                    DropdownMenuItem(value: 'eq', child: Text('等于 =')),
                  ],
                  onChanged: (v) {
                    if (v != null) setState(() => _operator = v);
                  },
                ),
              ),
              const SizedBox(width: 8),
              // 数值
              Expanded(
                child: TextField(
                  controller: _valueController,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    isDense: true,
                    hintText: '数值',
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // 单位
              SizedBox(
                width: 70,
                child: DropdownButtonFormField<String>(
                  value: _unit,
                  isDense: true,
                  decoration: const InputDecoration(
                    isDense: true,
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'KB', child: Text('KB')),
                    DropdownMenuItem(value: 'MB', child: Text('MB')),
                    DropdownMenuItem(value: 'GB', child: Text('GB')),
                  ],
                  onChanged: (v) {
                    if (v != null) setState(() => _unit = v);
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Checkbox(
                value: _negate,
                onChanged: (v) =>
                    setState(() => _negate = v ?? false),
              ),
              const Text('取反'),
            ],
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('取消'),
        ),
        FilledButton(
          onPressed: () {
            final value = double.tryParse(_valueController.text) ?? 10;
            widget.service.updateSizeFilter(
              enabled: true,
              op: _operator,
              value: value,
              unit: _unit,
              negate: _negate,
            );
            Navigator.pop(context);
          },
          child: const Text('应用'),
        ),
      ],
    );
  }
}

// ─── 后缀筛选对话框 ────────────────────────────────────────

class _ExtFilterDialog extends StatefulWidget {
  final FileService service;
  const _ExtFilterDialog({required this.service});

  @override
  State<_ExtFilterDialog> createState() => _ExtFilterDialogState();
}

class _ExtFilterDialogState extends State<_ExtFilterDialog> {
  late TextEditingController _extController;
  late bool _negate;

  @override
  void initState() {
    super.initState();
    _extController = TextEditingController(
      text: widget.service.extValue,
    );
    _negate = widget.service.extNegate;
  }

  @override
  void dispose() {
    _extController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('后缀筛选'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _extController,
            decoration: const InputDecoration(
              hintText: 'jpg,png,gif（逗号分隔，支持 * 通配）',
              isDense: true,
              border: OutlineInputBorder(),
            ),
            autofocus: true,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Checkbox(
                value: _negate,
                onChanged: (v) =>
                    setState(() => _negate = v ?? false),
              ),
              const Text('取反（排除这些后缀）'),
            ],
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('取消'),
        ),
        FilledButton(
          onPressed: () {
            widget.service.updateExtFilter(
              enabled: _extController.text.trim().isNotEmpty,
              value: _extController.text.trim(),
              negate: _negate,
            );
            Navigator.pop(context);
          },
          child: const Text('应用'),
        ),
      ],
    );
  }
}

// ─── 日期筛选对话框 ────────────────────────────────────────

class _DateFilterDialog extends StatefulWidget {
  final FileService service;
  const _DateFilterDialog({required this.service});

  @override
  State<_DateFilterDialog> createState() => _DateFilterDialogState();
}

class _DateFilterDialogState extends State<_DateFilterDialog> {
  late TextEditingController _daysController;
  late bool _negate;

  @override
  void initState() {
    super.initState();
    _daysController = TextEditingController(
      text: widget.service.dateValue.toString(),
    );
    _negate = widget.service.dateNegate;
  }

  @override
  void dispose() {
    _daysController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('日期筛选'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              const Text('近'),
              const SizedBox(width: 8),
              SizedBox(
                width: 80,
                child: TextField(
                  controller: _daysController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    isDense: true,
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              const Text('天内修改'),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Checkbox(
                value: _negate,
                onChanged: (v) =>
                    setState(() => _negate = v ?? false),
              ),
              const Text('取反（排除这些日期）'),
            ],
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('取消'),
        ),
        FilledButton(
          onPressed: () {
            final days = int.tryParse(_daysController.text) ?? 7;
            widget.service.updateDateFilter(
              enabled: true,
              value: days,
              negate: _negate,
            );
            Navigator.pop(context);
          },
          child: const Text('应用'),
        ),
      ],
    );
  }
}
