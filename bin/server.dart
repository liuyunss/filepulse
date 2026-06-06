import 'dart:io';
import 'dart:convert';
import 'package:path/path.dart' as p;

class FileServer {
  final int port;
  late HttpServer _server;
  String _scannedPath = '';

  FileServer({this.port = 8080});

  Future<void> start() async {
    _server = await HttpServer.bind(Internet.anyIPv4, port);
    print('文件脉搏服务已启动: http://localhost:$port');

    await for (final request in _server) {
      await _handleRequest(request);
    }
  }

  Future<void> _handleRequest(HttpRequest request) async {
    // CORS 头
    request.response.headers.add('Access-Control-Allow-Origin', '*');
    request.response.headers
        .add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    request.response.headers
        .add('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method == 'OPTIONS') {
      request.response.statusCode = 204;
      await request.response.close();
      return;
    }

    try {
      if (request.method == 'POST' && request.uri.path == '/api/scan') {
        await _handleScan(request);
      } else if (request.method == 'POST' &&
          request.uri.path == '/api/delete') {
        await _handleDelete(request);
      } else if (request.method == 'POST' &&
          request.uri.path == '/api/dissolve') {
        await _handleDissolve(request);
      } else {
        // 静态文件服务
        await _serveStaticFiles(request);
      }
    } catch (e) {
      request.response.statusCode = 500;
      request.response
          .write(jsonEncode({'error': e.toString()}));
      await request.response.close();
    }
  }

  Future<void> _handleScan(HttpRequest request) async {
    final body = await utf8.decoder.bind(request).join();
    final data = jsonDecode(body);
    final path = data['path'] as String;
    final threads = data['threads'] as int? ?? Platform.numberOfProcessors;

    _scannedPath = path;
    final directory = Directory(path);
    if (!await directory.exists()) {
      request.response.statusCode = 404;
      request.response
          .write(jsonEncode({'error': '文件夹不存在'}));
      await request.response.close();
      return;
    }

    final files = <Map<String, dynamic>>[];

    // 使用 Isolate 并发扫描（简化版：直接递归扫描）
    await _scanDirectory(directory, files, maxThreads: threads);

    request.response.headers.contentType = ContentType.json;
    request.response.write(jsonEncode({'files': files}));
    await request.response.close();
  }

  Future<void> _scanDirectory(
    Directory dir,
    List<Map<String, dynamic>> files, {
    int maxThreads = 4,
  }) async {
    try {
      final entities = await dir.list(followLinks: false).toList();

      // 分批处理以控制并发
      final batchSize = (entities.length / maxThreads).ceil().clamp(1, 100);

      for (var i = 0; i < entities.length; i += batchSize) {
        final batch = entities.sublist(
          i,
          (i + batchSize).clamp(0, entities.length),
        );

        await Future.wait(
          batch.map((entity) async {
            try {
              final stat = await entity.stat();
              final filePath = entity.path;
              final name = p.basename(filePath);
              final ext = p.extension(filePath).replaceFirst('.', '');

              files.add({
                'name': name,
                'path': filePath,
                'parentPath': p.dirname(filePath),
                'size': stat.size,
                'extension': ext,
                'modifiedAt': stat.modified.toIso8601String(),
                'createdAt': stat.changed.toIso8601String(),
                'isDirectory': entity is Directory,
              });

              // 递归扫描子文件夹
              if (entity is Directory) {
                await _scanDirectory(entity, files, maxThreads: maxThreads);
              }
            } catch (e) {
              print('跳过无法访问的文件: ${entity.path} - $e');
            }
          }),
        );
      }
    } catch (e) {
      print('跳过无法访问的目录: ${dir.path} - $e');
    }
  }

  Future<void> _handleDelete(HttpRequest request) async {
    final body = await utf8.decoder.bind(request).join();
    final data = jsonDecode(body);
    final paths = List<String>.from(data['paths']);

    // 路径安全验证：确保路径在已扫描目录内
    for (final path in paths) {
      if (!_isPathAllowed(path)) {
        request.response.statusCode = 403;
        request.response.write(jsonEncode({'error': '不允许操作该路径: $path'}));
        await request.response.close();
        return;
      }
    }

    final results = <String, dynamic>{};
    for (final path in paths) {
      try {
        final entity = FileSystemEntity.typeSync(path);
        if (entity == FileSystemEntityType.file) {
          await File(path).delete();
          results[path] = 'deleted';
        } else if (entity == FileSystemEntityType.directory) {
          await Directory(path).delete(recursive: true);
          results[path] = 'deleted';
        }
      } catch (e) {
        results[path] = 'error: $e';
      }
    }

    request.response.headers.contentType = ContentType.json;
    request.response.write(jsonEncode({
      'success': true,
      'results': results,
    }));
    await request.response.close();
  }

  Future<void> _handleDissolve(HttpRequest request) async {
    final body = await utf8.decoder.bind(request).join();
    final data = jsonDecode(body);
    final path = data['path'] as String;
    final keepLevels = data['keepLevels'] as int;

    // 路径安全验证
    if (!_isPathAllowed(path)) {
      request.response.statusCode = 403;
      request.response.write(jsonEncode({'error': '不允许操作该路径: $path'}));
      await request.response.close();
      return;
    }

    final dir = Directory(path);
    final files =
        await dir.list(recursive: true).where((e) => e is File).toList();

    for (final file in files) {
      final relativePath = p.relative(file.path, from: path);
      final parts = relativePath.split(Platform.pathSeparator);

      if (parts.length > keepLevels) {
        final newParent = p.join(
          path,
          parts.sublist(0, keepLevels).join(Platform.pathSeparator),
        );
        final newPath = p.join(newParent, p.basename(file.path));

        await Directory(newParent).create(recursive: true);
        if (file.path != newPath) {
          await (file as File).rename(newPath);
        }
      }
    }

    // 删除空文件夹
    await _deleteEmptyFolders(dir);

    request.response.headers.contentType = ContentType.json;
    request.response.write(jsonEncode({'success': true}));
    await request.response.close();
  }

  /// 路径安全验证：拒绝系统敏感路径，确保在已扫描目录内
  bool _isPathAllowed(String path) {
    // 使用 p.normalize() 规范化路径，解析 .. 段防止路径遍历
    final resolved = p.normalize(File(path).absolute.path);
    // 拒绝系统敏感目录
    final blockedPrefixes = ['/etc', '/bin', '/sbin', '/usr', '/sys', '/proc', '/dev', '/boot', '/lib'];
    for (final prefix in blockedPrefixes) {
      if (resolved.startsWith(prefix)) return false;
    }
    // 如果有已扫描路径，验证是否在其下
    if (_scannedPath.isNotEmpty) {
      final scannedDir = p.normalize(Directory(_scannedPath).absolute.path);
      if (!resolved.startsWith(scannedDir)) return false;
    } else {
      // 未扫描状态下拒绝所有操作，防止未授权访问
      return false;
    }
    return true;
  }

  Future<void> _deleteEmptyFolders(Directory dir) async {
    await for (final entity in dir.list(recursive: false)) {
      if (entity is Directory) {
        final contents = await entity.list().isEmpty;
        if (contents) {
          await entity.delete();
        } else {
          await _deleteEmptyFolders(entity);
        }
      }
    }
  }

  Future<void> _serveStaticFiles(HttpRequest request) async {
    var path = request.uri.path;
    if (path == '/') path = '/index.html';

    final file = File('build/web$path');
    if (await file.exists()) {
      final contentType = _getContentType(path);
      request.response.headers.contentType = contentType;
      await file.openRead().pipe(request.response);
    } else {
      // SPA fallback: 返回 index.html
      final indexFile = File('build/web/index.html');
      if (await indexFile.exists()) {
        request.response.headers.contentType = ContentType.html;
        await indexFile.openRead().pipe(request.response);
      } else {
        request.response.statusCode = 404;
        await request.response.close();
      }
    }
  }

  ContentType _getContentType(String path) {
    if (path.endsWith('.html')) return ContentType.html;
    if (path.endsWith('.js')) {
      return ContentType('application', 'javascript');
    }
    if (path.endsWith('.css')) return ContentType('text', 'css');
    if (path.endsWith('.json')) return ContentType.json;
    if (path.endsWith('.png')) return ContentType('image', 'png');
    if (path.endsWith('.jpg')) return ContentType('image', 'jpeg');
    if (path.endsWith('.ico')) return ContentType('image', 'x-icon');
    if (path.endsWith('.woff2')) {
      return ContentType('font', 'woff2');
    }
    if (path.endsWith('.woff')) return ContentType('font', 'woff');
    if (path.endsWith('.ttf')) return ContentType('font', 'ttf');
    return ContentType.binary;
  }
}

void main(List<String> args) {
  final port = int.tryParse(args.isNotEmpty ? args[0] : '8080') ?? 8080;
  FileServer(port: port).start();
}
