import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:video_compress/video_compress.dart';

/// Comprime vídeo para caber no Firestore (estilo WhatsApp — qualidade baixa).
Future<String?> compressVideoForProof(String filePath) async {
  try {
    final qualities = [
      VideoQuality.LowQuality,
      VideoQuality.Res640x480Quality,
      VideoQuality.DefaultQuality,
    ];

    for (final quality in qualities) {
      final info = await VideoCompress.compressVideo(
        filePath,
        quality: quality,
        deleteOrigin: false,
        includeAudio: true,
        frameRate: 24,
      );

      final compressedPath = info?.file?.path;
      if (compressedPath == null) continue;

      final bytes = await File(compressedPath).readAsBytes();
      // Firestore: limite ~1 MB por campo; base64 ≈ +33%.
      if (bytes.length <= 700 * 1024) {
        return base64Encode(bytes);
      }
    }

    // Última tentativa: qualidade mínima possível.
    final info = await VideoCompress.compressVideo(
      filePath,
      quality: VideoQuality.LowQuality,
      deleteOrigin: false,
      includeAudio: false,
      frameRate: 15,
    );
    final path = info?.file?.path;
    if (path == null) return null;

    final bytes = await File(path).readAsBytes();
    if (bytes.length <= 900 * 1024) {
      return base64Encode(bytes);
    }
    return null;
  } catch (_) {
    return null;
  } finally {
    await VideoCompress.deleteAllCache();
  }
}

/// Escolhe vídeo da câmera ou galeria e comprime.
Future<String?> pickAndCompressVideo(BuildContext context) async {
  final source = await showModalBottomSheet<ImageSource>(
    context: context,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (context) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 8),
          ListTile(
            leading: const Icon(Icons.videocam_outlined),
            title: const Text('Gravar vídeo'),
            onTap: () => Navigator.of(context).pop(ImageSource.camera),
          ),
          ListTile(
            leading: const Icon(Icons.video_library_outlined),
            title: const Text('Escolher da galeria'),
            onTap: () => Navigator.of(context).pop(ImageSource.gallery),
          ),
          const SizedBox(height: 8),
        ],
      ),
    ),
  );
  if (source == null) return null;

  final picked = await ImagePicker().pickVideo(
    source: source,
    maxDuration: const Duration(seconds: 30),
  );
  if (picked == null) return null;

  return compressVideoForProof(picked.path);
}
