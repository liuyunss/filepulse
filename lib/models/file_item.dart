class FileItem {
  final String name;
  final String path;
  final String parentPath;
  final int size;
  final String extension;
  final DateTime modifiedAt;
  final DateTime createdAt;
  final bool isDirectory;

  FileItem({
    required this.name,
    required this.path,
    required this.parentPath,
    required this.size,
    required this.extension,
    required this.modifiedAt,
    required this.createdAt,
    this.isDirectory = false,
  });

  factory FileItem.fromJson(Map<String, dynamic> json) {
    return FileItem(
      name: json['name'] ?? '',
      path: json['path'] ?? '',
      parentPath: json['parentPath'] ?? '',
      size: json['size'] ?? 0,
      extension: json['extension'] ?? '',
      modifiedAt: DateTime.tryParse(json['modifiedAt'] ?? '') ?? DateTime.now(),
      createdAt: DateTime.tryParse(json['createdAt'] ?? '') ?? DateTime.now(),
      isDirectory: json['isDirectory'] ?? false,
    );
  }

  /// 格式化文件大小为人类可读字符串（静态方法，可从外部调用）
  static String formatSize(int bytes) {
    if (bytes >= 1073741824) {
      return '${(bytes / 1073741824).toStringAsFixed(2)} GB';
    } else if (bytes >= 1048576) {
      return '${(bytes / 1048576).toStringAsFixed(2)} MB';
    } else if (bytes >= 1024) {
      return '${(bytes / 1024).toStringAsFixed(2)} KB';
    }
    return '$bytes B';
  }

  String get sizeFormatted {
    return FileItem.formatSize(size);
  }

  /// 用于重复文件检测的 key：文件名+扩展名+大小
  /// 注意：此处使用启发式匹配。如需更精确检测，可考虑基于内容的哈希（如 MD5/SHA256），
  /// 但会显著增加大目录的扫描时间。
  String get duplicateKey => '${name}_${extension}_|$size';
}
