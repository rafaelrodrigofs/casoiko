import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:casoiko/theme/app_colors.dart';

import 'health_ring.dart';

/// Hero verde full-bleed no topo da aba Casa.
/// [collapseT] vai de 0 (expandido) a 1 (barra compacta).
class CasaHeroHeader extends StatelessWidget {
  const CasaHeroHeader({
    super.key,
    required this.collapseT,
    required this.progress,
    required this.pending,
    required this.done,
    required this.total,
    required this.dateLabel,
    required this.onSignOut,
    required this.topPadding,
  });

  final double collapseT;
  final double progress;
  final int pending;
  final int done;
  final int total;
  final String dateLabel;
  final VoidCallback onSignOut;
  final double topPadding;

  bool get _isCollapsed => collapseT > 0.4;

  bool get _showExpandedBody => collapseT < 0.35;

  String get _statusLabel => HouseHealthStyle.statusLabel(progress, total);
  Color get _accentColor => HouseHealthStyle.accentColor(progress, total);
  IconData get _statusIcon => HouseHealthStyle.statusIcon(progress, total);
  int get _percent => (progress * 100).round();

  String get _compactStats {
    if (total == 0) return 'Sem tarefas';
    return '$pending pend.';
  }

  @override
  Widget build(BuildContext context) {
    final expandedOpacity =
        (1 - collapseT * 2.2).clamp(0.0, 1.0);
    final bottomRadius = 28.0 * (1 - collapseT * 0.6);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF0F3D32),
              AppColors.primary,
              Color(0xFF1A5F4C),
            ],
          ),
          borderRadius: BorderRadius.vertical(
            bottom: Radius.circular(bottomRadius),
          ),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.vertical(
            bottom: Radius.circular(bottomRadius),
          ),
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (_showExpandedBody && expandedOpacity > 0.05) ...[
                Positioned(
                  right: -20,
                  top: -10,
                  child: Opacity(
                    opacity: expandedOpacity,
                    child: Container(
                      width: 160,
                      height: 160,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withValues(alpha: 0.06),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: -30,
                  bottom: -40,
                  child: Opacity(
                    opacity: expandedOpacity,
                    child: Container(
                      width: 120,
                      height: 120,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _accentColor.withValues(alpha: 0.12),
                      ),
                    ),
                  ),
                ),
              ],
              if (_isCollapsed) ...[
                Positioned(
                  top: topPadding,
                  left: 20,
                  right: 0,
                  height: kCasaHeroToolbarHeight,
                  child: _topBar(compact: true),
                ),
                Positioned(
                  top: topPadding,
                  right: 0,
                  child: _logoutButton(compact: true),
                ),
              ] else
                Padding(
                  padding: EdgeInsets.fromLTRB(20, topPadding + 2, 20, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _topBar(compact: false),
                      if (_showExpandedBody) ...[
                        const SizedBox(height: 8),
                        Expanded(
                          child: Opacity(
                            opacity: expandedOpacity,
                            child: ClipRect(
                              child: Align(
                                alignment: Alignment.topCenter,
                                child: _expandedBody(),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              if (!_isCollapsed)
                Positioned(
                  top: topPadding + 2,
                  right: 4,
                  child: _logoutButton(),
                ),
            ],
          ),
        ),
      ),
    );
  }

  /// Bloco anel + textos, centralizado na largura disponível.
  Widget _expandedBody() {
    return LayoutBuilder(
      builder: (context, constraints) {
        const ringSize = 108.0;
        const gap = 14.0;
        const containerPadding = 24.0; // 12 + 12 horizontal

        return Align(
          alignment: Alignment.center,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                SizedBox(
                  width: ringSize,
                  height: ringSize,
                  child: CustomPaint(
                    painter: HealthRingPainter(
                      progress: progress,
                      accent: _accentColor,
                    ),
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            total == 0 ? '—' : '$_percent%',
                            style: const TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                              height: 1,
                            ),
                          ),
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
                ),
                const SizedBox(width: gap),
                Flexible(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      maxWidth: constraints.maxWidth -
                          ringSize -
                          gap -
                          containerPadding,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
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
                              Icon(_statusIcon, size: 14, color: _accentColor),
                              const SizedBox(width: 6),
                              Flexible(
                                child: Text(
                                  _statusLabel.toUpperCase(),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.8,
                                    color: _accentColor,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Estado da casa',
                          style: TextStyle(
                            fontSize: 21,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                            height: 1.1,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          total == 0
                              ? 'Crie tarefas para acompanhar o dia da família.'
                              : '$pending pendente${pending == 1 ? '' : 's'} · '
                                  '$done feita${done == 1 ? '' : 's'} $dateLabel',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.white.withValues(alpha: 0.85),
                            height: 1.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _logoutButton({bool compact = false}) {
    return IconButton(
      tooltip: 'Sair',
      onPressed: onSignOut,
      padding: EdgeInsets.zero,
      constraints: BoxConstraints(
        minWidth: compact ? 40 : 44,
        minHeight: compact ? 40 : 44,
      ),
      icon: Icon(
        Icons.logout_rounded,
        color: Colors.white,
        size: compact ? 22 : 24,
      ),
    );
  }

  Widget _topBar({required bool compact}) {
    if (compact) {
    return SizedBox(
      height: kCasaHeroToolbarHeight,
      child: Row(
          children: [
            const Icon(Icons.home_rounded, color: Colors.white, size: 22),
            const SizedBox(width: 8),
            const Text(
              'Casa',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                total == 0 ? 'Sem tarefas' : '$_percent% · $_compactStats',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Colors.white.withValues(alpha: 0.85),
                ),
              ),
            ),
            const SizedBox(width: 40),
          ],
        ),
      );
    }

    return const SizedBox(
      height: 44,
      child: Center(
        child: Text(
          'Casa',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}

/// Altura da barra compacta (sem status bar).
const kCasaHeroToolbarHeight = 44.0;

/// Conteúdo expandido abaixo da status bar (Flutter soma o topPadding).
const kCasaHeroExpandedBodyHeight = 8.0 + 124.0 + 12.0;

/// Altura expandida passada ao [SliverAppBar.expandedHeight].
double casaHeroExpandedHeight() =>
    kCasaHeroToolbarHeight + kCasaHeroExpandedBodyHeight;

/// Altura colapsada passada ao [SliverAppBar.collapsedHeight].
double casaHeroCollapsedHeight() => kCasaHeroToolbarHeight;

/// Altura efetiva no ecrã (status bar + conteúdo) — para animação do hero.
double casaHeroEffectiveExpandedHeight(double topPadding) =>
    topPadding + casaHeroExpandedHeight();

double casaHeroEffectiveCollapsedHeight(double topPadding) =>
    topPadding + casaHeroCollapsedHeight();
