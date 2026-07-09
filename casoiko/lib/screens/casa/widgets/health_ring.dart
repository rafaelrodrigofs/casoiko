import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Estilo visual do indicador de saúde da casa.
abstract final class HouseHealthStyle {
  static String statusLabel(double progress, int total) {
    if (total == 0) return 'Aguardando rotina';
    if (progress >= 0.9) return 'Casa excelente';
    if (progress >= 0.7) return 'Casa saudável';
    if (progress >= 0.4) return 'Em progresso';
    return 'Precisa de atenção';
  }

  static Color accentColor(double progress, int total) {
    if (total == 0) return const Color(0xFF64748B);
    if (progress >= 0.7) return const Color(0xFF34D399);
    if (progress >= 0.4) return const Color(0xFFFBBF24);
    return const Color(0xFFF87171);
  }

  static IconData statusIcon(double progress, int total) {
    if (total == 0) return Icons.nightlight_round;
    if (progress >= 0.7) return Icons.favorite;
    if (progress >= 0.4) return Icons.trending_up;
    return Icons.warning_amber_rounded;
  }
}

/// Anel circular de progresso da saúde da casa.
class HealthRingPainter extends CustomPainter {
  HealthRingPainter({required this.progress, required this.accent});

  final double progress;
  final Color accent;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 8;
    const stroke = 9.0;

    final trackPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.12)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;

    canvas.drawCircle(center, radius, trackPaint);

    if (progress <= 0) return;

    final rect = Rect.fromCircle(center: center, radius: radius);
    const startAngle = -math.pi / 2;
    final sweep = 2 * math.pi * progress;

    final glowPaint = Paint()
      ..shader = SweepGradient(
        startAngle: startAngle,
        endAngle: startAngle + sweep,
        colors: [
          accent.withValues(alpha: 0.3),
          accent,
          Colors.white.withValues(alpha: 0.9),
        ],
      ).createShader(rect)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke + 4
      ..strokeCap = StrokeCap.round
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6);

    canvas.drawArc(rect, startAngle, sweep, false, glowPaint);

    final arcPaint = Paint()
      ..shader = SweepGradient(
        startAngle: startAngle,
        endAngle: startAngle + sweep,
        colors: [accent, Colors.white],
      ).createShader(rect)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(rect, startAngle, sweep, false, arcPaint);
  }

  @override
  bool shouldRepaint(covariant HealthRingPainter oldDelegate) {
    return oldDelegate.progress != progress || oldDelegate.accent != accent;
  }
}
