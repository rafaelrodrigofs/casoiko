import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:video_player/video_player.dart';
import 'package:casoiko/theme/app_colors.dart';

/// Reproduz vídeo de prova salvo em base64 no Firestore.
class ProofVideoPlayer extends StatefulWidget {
  const ProofVideoPlayer({
    super.key,
    required this.videoBase64,
    this.height = 200,
  });

  final String videoBase64;
  final double height;

  @override
  State<ProofVideoPlayer> createState() => _ProofVideoPlayerState();
}

class _ProofVideoPlayerState extends State<ProofVideoPlayer> {
  VideoPlayerController? _controller;
  bool _loading = true;
  String? _error;
  String? _tempPath;

  @override
  void initState() {
    super.initState();
    _initPlayer();
  }

  Future<void> _initPlayer() async {
    try {
      final bytes = base64Decode(widget.videoBase64);
      final dir = await getTemporaryDirectory();
      final file = File(
        '${dir.path}/proof_${DateTime.now().millisecondsSinceEpoch}.mp4',
      );
      await file.writeAsBytes(bytes, flush: true);
      _tempPath = file.path;

      final controller = VideoPlayerController.file(file);
      await controller.initialize();
      controller.addListener(() {
        if (mounted) setState(() {});
      });

      if (!mounted) {
        await controller.dispose();
        return;
      }

      setState(() {
        _controller = controller;
        _loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Não foi possível abrir o vídeo';
          _loading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    if (_tempPath != null) {
      File(_tempPath!).delete().ignore();
    }
    super.dispose();
  }

  void _togglePlay() {
    final controller = _controller;
    if (controller == null) return;
    setState(() {
      if (controller.value.isPlaying) {
        controller.pause();
      } else {
        controller.play();
      }
    });
  }

  void _openFullscreen() {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;

    Navigator.of(context).push(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (context) => _FullscreenProofVideo(
          controller: controller,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return SizedBox(
        height: widget.height,
        child: const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }

    if (_error != null || _controller == null) {
      return SizedBox(
        height: widget.height,
        child: Center(
          child: Text(
            _error ?? 'Erro ao carregar vídeo',
            style: const TextStyle(color: AppColors.textSecondary),
          ),
        ),
      );
    }

    final controller = _controller!;

    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: ColoredBox(
        color: Colors.black,
        child: SizedBox(
          height: widget.height,
          width: double.infinity,
          child: Stack(
            alignment: Alignment.center,
            children: [
              FittedBox(
                fit: BoxFit.contain,
                child: SizedBox(
                  width: controller.value.size.width,
                  height: controller.value.size.height,
                  child: VideoPlayer(controller),
                ),
              ),
              GestureDetector(
                onTap: _togglePlay,
                behavior: HitTestBehavior.opaque,
                child: AnimatedOpacity(
                  opacity: controller.value.isPlaying ? 0.0 : 1.0,
                  duration: const Duration(milliseconds: 200),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: const BoxDecoration(
                      color: Colors.black54,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.play_arrow_rounded,
                      color: Colors.white,
                      size: 44,
                    ),
                  ),
                ),
              ),
              Positioned(
                right: 8,
                bottom: 8,
                child: IconButton(
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.black54,
                  ),
                  onPressed: _openFullscreen,
                  icon: const Icon(
                    Icons.fullscreen,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FullscreenProofVideo extends StatefulWidget {
  const _FullscreenProofVideo({required this.controller});

  final VideoPlayerController controller;

  @override
  State<_FullscreenProofVideo> createState() => _FullscreenProofVideoState();
}

class _FullscreenProofVideoState extends State<_FullscreenProofVideo> {
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onUpdate);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onUpdate);
    super.dispose();
  }

  void _onUpdate() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Prova em vídeo'),
      ),
      body: Center(
        child: AspectRatio(
          aspectRatio: widget.controller.value.aspectRatio,
          child: VideoPlayer(widget.controller),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppColors.primary,
        onPressed: () {
          setState(() {
            if (widget.controller.value.isPlaying) {
              widget.controller.pause();
            } else {
              widget.controller.play();
            }
          });
        },
        child: Icon(
          widget.controller.value.isPlaying ? Icons.pause : Icons.play_arrow,
        ),
      ),
    );
  }
}
