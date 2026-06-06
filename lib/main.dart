import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'services/file_service.dart';
import 'widgets/app.dart';

void main() {
  runApp(
    ChangeNotifierProvider(
      create: (_) => FileService(),
      child: const FilePulseApp(),
    ),
  );
}
