import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:casoiko/theme/app_colors.dart';

import '../../../models/house_task.dart';
import '../../../utils/task_categories.dart';

/// Estatística de uma categoria para o painel de saúde.
class HouseHealthPillar {
  const HouseHealthPillar({
    required this.label,
    required this.icon,
    required this.color,
    required this.progress,
  });

  final String label;
  final IconData icon;
  final Color color;
  final double progress;
}

/// Card visual do "organismo" da casa — anel de saúde + pilares.
class HouseHealthCard extends StatelessWidget {
  const HouseHealthCard({
    super.key,
    required this.progress,
    required this.pending,
    required this.done,
    required this.total,
    required this.pillars,
  });

  final double progress;
  final int pending;
  final int done;
  final int total;
  final List<HouseHealthPillar> pillars;

  String get _statusLabel {
    if (total == 0) return 'Aguardando rotina';
    final p = progress;
    if (p >= 0.9) return 'Casa excelente';
    if (p >= 0.7) return 'Casa saudável';
    if (p >= 0.4) return 'Em progresso';
    return 'Precisa de atenção';
  }

  Color get _accentColor {
    if (total == 0) return const Color(0xFF64748B);
    if (progress >= 0.7) return const Color(0xFF34D399);
    if (progress >= 0.4) return const Color(0xFFFBBF24);
    return const Color(0xFFF87171);
  }

  @override
  Widget build(BuildContext context) {
    final percent = (progress * 100).round();

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            const Color(0xFF0F3D32),
            AppColors.primary,
            const Color(0xFF1B6B54).withValues(alpha: 0.92),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.35),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            right: -30,
            top: -30,
            child: Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.06),
              ),
            ),
          ),
          Positioned(
            left: -20,
            bottom: -40,
            child: Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _accentColor.withValues(alpha: 0.12),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0, end: progress),
                      duration: const Duration(milliseconds: 900),
                      curve: Curves.easeOutCubic,
                      builder: (context, animProgress, _) {
                        return SizedBox(
                          width: 108,
                          height: 108,
                          child: CustomPaint(
                            painter: _HealthRingPainter(
                              progress: animProgress,
                              accent: _accentColor,
                            ),
                            child: Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    total == 0 ? '—' : '$percent%',
                                    style: const TextStyle(
                                      fontSize: 26,
                                      fontWeight: FontWeight.w800,
                                      color: Colors.white,
                                      height: 1,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    'saúde',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      letterSpacing: 0.6,
                                      color: Colors.white.withValues(alpha: 0.75),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                    const SizedBox(width: 18),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 5,
                            ),
                            decoration: BoxDecoration(
                              color: _accentColor.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: _accentColor.withValues(alpha: 0.45),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  _statusIcon,
                                  size: 14,
                                  color: _accentColor,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  _statusLabel.toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.8,
                                    color: _accentColor,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 10),
                          const Text(
                            'Estado da casa',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                              height: 1.1,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            total == 0
                                ? 'Crie tarefas para acompanhar o dia da família.'
                                : '$pending pendente${pending == 1 ? '' : 's'} · '
                                    '$done feita${done == 1 ? '' : 's'} hoje',
                            style: TextStyle(
                              fontSize: 13,
                              color: Colors.white.withValues(alpha: 0.82),
                              height: 1.35,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                if (pillars.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  Text(
                    'PILARES DE HOJE',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1,
                      color: Colors.white.withValues(alpha: 0.55),
                    ),
                  ),
                  const SizedBox(height: 10),
                  ...pillars.take(4).map(
                        (pillar) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: _PillarRow(pillar: pillar),
                        ),
                      ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  IconData get _statusIcon {
    if (total == 0) return Icons.nightlight_round;
    if (progress >= 0.7) return Icons.favorite;
    if (progress >= 0.4) return Icons.trending_up;
    return Icons.warning_amber_rounded;
  }
}

class _PillarRow extends StatelessWidget {
  const _PillarRow({required this.pillar});

  final HouseHealthPillar pillar;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(pillar.icon, size: 16, color: pillar.color),
        const SizedBox(width: 8),
        SizedBox(
          width: 72,
          child: Text(
            pillar.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: Colors.white.withValues(alpha: 0.9),
            ),
          ),
        ),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: pillar.progress),
              duration: const Duration(milliseconds: 700),
              curve: Curves.easeOut,
              builder: (context, value, _) {
                return LinearProgressIndicator(
                  value: value,
                  minHeight: 6,
                  backgroundColor: Colors.white.withValues(alpha: 0.15),
                  color: pillar.color,
                );
              },
            ),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 32,
          child: Text(
            '${(pillar.progress * 100).round()}%',
            textAlign: TextAlign.right,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: Colors.white.withValues(alpha: 0.75),
            ),
          ),
        ),
      ],
    );
  }
}

class _HealthRingPainter extends CustomPainter {
  _HealthRingPainter({required this.progress, required this.accent});

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
  bool shouldRepaint(covariant _HealthRingPainter oldDelegate) {
    return oldDelegate.progress != progress || oldDelegate.accent != accent;
  }
}

/// Agrupa tarefas de hoje por categoria para os pilares do card.
List<HouseHealthPillar> buildHealthPillars({
  required List<HouseTask> todayTasks,
  required Set<String> doneTaskIds,
}) {
  final byCategory = <String, List<HouseTask>>{};
  for (final task in todayTasks) {
    byCategory.putIfAbsent(task.categoryId, () => []).add(task);
  }

  final pillars = <HouseHealthPillar>[];
  for (final entry in byCategory.entries) {
    final cat = taskCategoryFor(entry.key);
    final total = entry.value.length;
    final done = entry.value.where((t) => doneTaskIds.contains(t.id)).length;
    pillars.add(
      HouseHealthPillar(
        label: cat.name.split(' ').first,
        icon: cat.icon,
        color: cat.color,
        progress: total == 0 ? 0 : done / total,
      ),
    );
  }

  pillars.sort((a, b) => a.progress.compareTo(b.progress));
  return pillars;
}
