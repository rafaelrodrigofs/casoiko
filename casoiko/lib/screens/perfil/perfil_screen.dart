import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:casoiko/theme/app_colors.dart';

import '../../models/finance_transaction.dart';
import '../../models/house_task.dart';
import '../../services/admin_service.dart';
import '../../services/auth_service.dart';
import '../../services/finance_service.dart';
import '../../services/house_service.dart';
import '../../services/task_service.dart';
import '../../utils/task_dates.dart';
import '../../widgets/shell_tab_bar.dart';
import '../admin/admin_hub_screen.dart';

class PerfilScreen extends StatefulWidget {
  const PerfilScreen({
    super.key,
    required this.authService,
  });

  final AuthService authService;

  @override
  State<PerfilScreen> createState() => _PerfilScreenState();
}

class _PerfilScreenState extends State<PerfilScreen> {
  final _houseService = HouseService();
  final _taskService = TaskService();
  final _financeService = FinanceService();

  late final Future<String> _houseIdFuture;
  int _heatYear = DateTime.now().year;
  int _donePeriodDays = 30;

  @override
  void initState() {
    super.initState();
    final user = widget.authService.currentUser;
    _houseIdFuture = user != null
        ? _houseService.ensureUserRegistered(user)
        : Future.value(HouseService.defaultHouseId);
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.authService.currentUser;
    final firstName = _firstName(user?.displayName);
    final photo = user?.photoURL ?? '';
    final uid = user?.uid ?? '';

    return FutureBuilder<String>(
      future: _houseIdFuture,
      builder: (context, houseSnap) {
        if (houseSnap.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            backgroundColor: AppColors.background,
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final houseId = houseSnap.data ?? HouseService.defaultHouseId;

        return StreamBuilder<List<HouseMember>>(
          stream: _financeService.membersStream(houseId),
          builder: (context, membersSnap) {
            final members = membersSnap.data ?? [];
            final canManage = AdminService.canManage(members, uid);

            return Scaffold(
              backgroundColor: AppColors.background,
              body: Column(
                children: [
                  ShellTabBar(
                    title: 'Perfil',
                    icon: Icons.person,
                    actions: [
                      if (canManage)
                        IconButton(
                          tooltip: 'Admin',
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => AdminHubScreen(
                                  authService: widget.authService,
                                  houseId: houseId,
                                ),
                              ),
                            );
                          },
                          icon: const Icon(
                            Icons.admin_panel_settings,
                            color: Colors.white,
                          ),
                        ),
                    ],
                  ),
                  Expanded(child: _buildBody(houseId, uid, firstName, photo)),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildBody(
    String houseId,
    String uid,
    String firstName,
    String photo,
  ) {
    final todayKey = HouseTask.dateKeyFor(TaskDates.today);
    final yearRange = TaskService.yearRangeKeys(_heatYear);
    final periodRange = TaskService.lastDaysRangeKeys(_donePeriodDays);
    final rangeStart = [
      yearRange.startKey,
      periodRange.startKey,
      HouseTask.dateKeyFor(
        TaskDates.today.subtract(const Duration(days: 400)),
      ),
    ].reduce((a, b) => a.compareTo(b) < 0 ? a : b);
    final rangeEnd = [
      yearRange.endKey,
      periodRange.endKey,
      todayKey,
    ].reduce((a, b) => a.compareTo(b) > 0 ? a : b);

    return StreamBuilder<List<HouseTask>>(
      stream: _taskService.tasksStream(houseId),
      builder: (context, tasksSnap) {
        final tasks = tasksSnap.data ?? [];

        return StreamBuilder<List<TaskCheck>>(
          stream: _taskService.checksStreamForRange(
            houseId,
            rangeStart,
            rangeEnd,
          ),
          builder: (context, checksSnap) {
            final checks = checksSnap.data ?? [];
            final todayChecks = {
              for (final c in checks.where((c) => c.dateKey == todayKey))
                c.taskId: c,
            };
            final dayTasks =
                tasks.where((t) => t.isVisibleOn(TaskDates.today)).toList();
            final doneToday =
                dayTasks.where((t) => todayChecks.containsKey(t.id)).length;
            final pendingToday = dayTasks.length - doneToday;
            final streak = _computeStreak(tasks, checks);
            final heatCounts = _countsByDay(
              checks.where(
                (c) =>
                    c.dateKey.compareTo(yearRange.startKey) >= 0 &&
                    c.dateKey.compareTo(yearRange.endKey) <= 0,
              ),
            );
            final myPeriodDone = checks.where((c) {
              if (c.doneBy != uid) return false;
              return c.dateKey.compareTo(periodRange.startKey) >= 0 &&
                  c.dateKey.compareTo(periodRange.endKey) <= 0;
            }).length;
            final housePeriodDone = checks.where((c) {
              return c.dateKey.compareTo(periodRange.startKey) >= 0 &&
                  c.dateKey.compareTo(periodRange.endKey) <= 0;
            }).length;

            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                _GreetingRow(
                  firstName: firstName,
                  photoUrl: photo,
                  streakDays: streak,
                ),
                const SizedBox(height: 16),
                _StatsRow(done: doneToday, pending: pendingToday),
                const SizedBox(height: 16),
                _HeatmapCard(
                  year: _heatYear,
                  countsByDay: heatCounts,
                  onYearChanged: (y) => setState(() => _heatYear = y),
                ),
                const SizedBox(height: 16),
                _CompletedCard(
                  periodDays: _donePeriodDays,
                  myDone: myPeriodDone,
                  houseDone: housePeriodDone,
                  onPeriodChanged: (d) =>
                      setState(() => _donePeriodDays = d),
                ),
              ],
            );
          },
        );
      },
    );
  }

  static String _firstName(String? displayName) {
    if (displayName == null || displayName.trim().isEmpty) return 'aí';
    return displayName.trim().split(RegExp(r'\s+')).first;
  }

  static Map<String, int> _countsByDay(Iterable<TaskCheck> checks) {
    final map = <String, int>{};
    for (final c in checks) {
      map[c.dateKey] = (map[c.dateKey] ?? 0) + 1;
    }
    return map;
  }

  /// Dias consecutivos com 100% das tarefas do dia concluídas.
  /// Se hoje ainda estiver incompleto, começa a contar a partir de ontem.
  static int _computeStreak(List<HouseTask> tasks, List<TaskCheck> checks) {
    final doneIdsByDay = <String, Set<String>>{};
    for (final c in checks) {
      doneIdsByDay.putIfAbsent(c.dateKey, () => {}).add(c.taskId);
    }

    var day = TaskDates.today;
    var streak = 0;

    for (var i = 0; i < 400; i++) {
      final visible = tasks.where((t) => t.isVisibleOn(day)).toList();
      final key = HouseTask.dateKeyFor(day);
      final done = doneIdsByDay[key] ?? const <String>{};
      final complete =
          visible.isNotEmpty && visible.every((t) => done.contains(t.id));

      if (!complete) {
        if (i == 0) {
          // Hoje incompleto: segue para ontem sem contar.
          day = day.subtract(const Duration(days: 1));
          continue;
        }
        break;
      }

      streak++;
      day = day.subtract(const Duration(days: 1));
    }

    return streak;
  }
}

class _GreetingRow extends StatelessWidget {
  const _GreetingRow({
    required this.firstName,
    required this.photoUrl,
    required this.streakDays,
  });

  final String firstName;
  final String photoUrl;
  final int streakDays;

  @override
  Widget build(BuildContext context) {
    final streakText = streakDays <= 0
        ? 'Complete as tarefas de hoje para iniciar a sequência!'
        : 'Rotina da casa em dia por $streakDays '
            '${streakDays == 1 ? 'dia' : 'dias'}!';

    return Row(
      children: [
        CircleAvatar(
          radius: 26,
          backgroundColor: AppColors.primary.withValues(alpha: 0.18),
          backgroundImage:
              photoUrl.isNotEmpty ? NetworkImage(photoUrl) : null,
          child: photoUrl.isEmpty
              ? const Icon(Icons.person, color: AppColors.primary, size: 28)
              : null,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Oi, $firstName',
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                streakText,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _StatsRow extends StatelessWidget {
  const _StatsRow({required this.done, required this.pending});

  final int done;
  final int pending;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _StatCard(label: 'Concluídas hoje', value: '$done'),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StatCard(label: 'Pendentes hoje', value: '$pending'),
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 88,
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 12),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: AppColors.textSecondary,
            ),
          ),
          const Spacer(),
          Text(
            value,
            style: const TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.w800,
              height: 1,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _HeatmapCard extends StatelessWidget {
  const _HeatmapCard({
    required this.year,
    required this.countsByDay,
    required this.onYearChanged,
  });

  final int year;
  final Map<String, int> countsByDay;
  final ValueChanged<int> onYearChanged;

  static const _levels = [
    Color(0xFFE8F1FE),
    Color(0xFFBFDBFE),
    Color(0xFF93C5FD),
    Color(0xFF60A5FA),
    Color(0xFF3B82F6),
  ];

  static const _dayLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  static const _monthLabels = [
    'jan.',
    'fev.',
    'mar.',
    'abr.',
    'mai.',
    'jun.',
    'jul.',
    'ago.',
    'set.',
    'out.',
    'nov.',
    'dez.',
  ];

  @override
  Widget build(BuildContext context) {
    final nowYear = DateTime.now().year;
    final years = [for (var y = nowYear; y >= nowYear - 2; y--) y];
    final weeks = _weeksForYear(year);
    final scale = _HeatColorScale.fromDailyCounts(countsByDay.values);

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.10),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                'Mapa de calor anual',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(width: 4),
              InkWell(
                onTap: () {
                  showDialog<void>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: const Text('Mapa de calor'),
                      content: const Text(
                        'Cada quadradinho é um dia. A cor é calibrada pelas '
                        'conclusões do ano (como no GitHub): dias fracos '
                        'relativos ao resto ficam claros; os mais ativos, escuros.\n\n'
                        'Se a casa quase sempre faz a mesma quantidade, '
                        'esses dias aparecem fortes — não como “fracos”.',
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx),
                          child: const Text('Entendi'),
                        ),
                      ],
                    ),
                  );
                },
                borderRadius: BorderRadius.circular(12),
                child: const Padding(
                  padding: EdgeInsets.all(2),
                  child: Icon(
                    Icons.info_outline,
                    size: 16,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
              const Spacer(),
              PopupMenuButton<int>(
                initialValue: year,
                onSelected: onYearChanged,
                itemBuilder: (context) => [
                  for (final y in years)
                    PopupMenuItem(value: y, child: Text('$y')),
                ],
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '$year',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const Icon(
                        Icons.expand_more,
                        size: 16,
                        color: AppColors.textSecondary,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _HeatmapGrid(
            weeks: weeks,
            year: year,
            countsByDay: countsByDay,
            scale: scale,
          ),
        ],
      ),
    );
  }

  /// Semanas domingo→sábado cobrindo o ano (células fora do ano ficam count 0).
  static List<List<DateTime>> _weeksForYear(int year) {
    final jan1 = DateTime(year, 1, 1);
    // DateTime.weekday: 1=seg … 7=dom → início no domingo.
    var cursor = jan1.subtract(Duration(days: jan1.weekday % 7));
    final last = DateTime(year, 12, 31);
    final weeks = <List<DateTime>>[];
    while (cursor.isBefore(last) || cursor.isAtSameMomentAs(last) ||
        weeks.isEmpty) {
      final week = [
        for (var i = 0; i < 7; i++) cursor.add(Duration(days: i)),
      ];
      if (week.every((d) => d.year > year)) break;
      weeks.add(week);
      cursor = cursor.add(const Duration(days: 7));
      if (weeks.length > 54) break;
    }
    return weeks;
  }

  static int? _firstWeekIndexForMonth(
    List<List<DateTime>> weeks,
    int year,
    int month,
  ) {
    for (var i = 0; i < weeks.length; i++) {
      if (weeks[i].any((d) => d.year == year && d.month == month && d.day <= 7)) {
        return i;
      }
    }
    return null;
  }
}

/// Escala calibrada pelos totais diários do período (quartis, estilo GitHub).
class _HeatColorScale {
  const _HeatColorScale._({
    required this.q1,
    required this.q2,
    required this.q3,
    required this.uniformActive,
  });

  final int q1;
  final int q2;
  final int q3;

  /// Quando todos os dias ativos têm o mesmo total (ex.: sempre 1).
  final bool uniformActive;

  factory _HeatColorScale.fromDailyCounts(Iterable<int> dailyCounts) {
    final nonzero = dailyCounts.where((c) => c > 0).toList()..sort();
    if (nonzero.isEmpty) {
      return const _HeatColorScale._(
        q1: 0,
        q2: 0,
        q3: 0,
        uniformActive: false,
      );
    }
    if (nonzero.first == nonzero.last) {
      return _HeatColorScale._(
        q1: nonzero.first,
        q2: nonzero.first,
        q3: nonzero.first,
        uniformActive: true,
      );
    }
    return _HeatColorScale._(
      q1: _percentile(nonzero, 0.25),
      q2: _percentile(nonzero, 0.50),
      q3: _percentile(nonzero, 0.75),
      uniformActive: false,
    );
  }

  static int _percentile(List<int> sortedAsc, double p) {
    if (sortedAsc.isEmpty) return 0;
    if (sortedAsc.length == 1) return sortedAsc.first;
    final i = ((sortedAsc.length - 1) * p).round().clamp(0, sortedAsc.length - 1);
    return sortedAsc[i];
  }

  Color colorFor(int count) {
    if (count <= 0) return _HeatmapCard._levels[0];
    // Rotina estável (tudo 1, tudo 2…): pinta no tom mais forte.
    if (uniformActive) return _HeatmapCard._levels[4];
    if (count <= q1) return _HeatmapCard._levels[1];
    if (count <= q2) return _HeatmapCard._levels[2];
    if (count <= q3) return _HeatmapCard._levels[3];
    return _HeatmapCard._levels[4];
  }
}

/// Grid com células quadradas + scroll horizontal (evita sobreposição).
class _HeatmapGrid extends StatefulWidget {
  const _HeatmapGrid({
    required this.weeks,
    required this.year,
    required this.countsByDay,
    required this.scale,
  });

  final List<List<DateTime>> weeks;
  final int year;
  final Map<String, int> countsByDay;
  final _HeatColorScale scale;

  static const _cell = 11.0;
  static const _gap = 3.0;

  @override
  State<_HeatmapGrid> createState() => _HeatmapGridState();
}

class _HeatmapGridState extends State<_HeatmapGrid> {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToCurrentMonth());
  }

  @override
  void didUpdateWidget(covariant _HeatmapGrid oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.year != widget.year ||
        oldWidget.weeks.length != widget.weeks.length) {
      WidgetsBinding.instance
          .addPostFrameCallback((_) => _scrollToCurrentMonth());
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToCurrentMonth() {
    if (!_scrollController.hasClients || widget.weeks.isEmpty) return;

    const step = _HeatmapGrid._cell + _HeatmapGrid._gap;
    final now = DateTime.now();
    final focusMonth =
        widget.year == now.year ? now.month : (widget.year < now.year ? 12 : 1);
    final weekIdx = _HeatmapCard._firstWeekIndexForMonth(
          widget.weeks,
          widget.year,
          focusMonth,
        ) ??
        0;

    // Alinha o mês atual no início da área visível (como abrir “no mês que estamos”).
    final target = (weekIdx * step).clamp(
      0.0,
      _scrollController.position.maxScrollExtent,
    );
    _scrollController.jumpTo(target);
  }

  @override
  Widget build(BuildContext context) {
    const cell = _HeatmapGrid._cell;
    const gap = _HeatmapGrid._gap;
    const step = cell + gap;
    final gridH = 7 * cell + 6 * gap;
    final weeks = widget.weeks;
    final gridW = weeks.isEmpty
        ? 0.0
        : weeks.length * cell + (weeks.length - 1) * gap;

    return SizedBox(
      height: gridH + 22,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              for (var i = 0; i < _HeatmapCard._dayLabels.length; i++)
                SizedBox(
                  width: 16,
                  height: i == 6 ? cell : step,
                  child: Align(
                    alignment: Alignment.topCenter,
                    child: SizedBox(
                      height: cell,
                      child: Center(
                        child: Text(
                          _HeatmapCard._dayLabels[i],
                          style: const TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w500,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 6),
          Expanded(
            child: SingleChildScrollView(
              controller: _scrollController,
              scrollDirection: Axis.horizontal,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: gridW,
                    height: gridH,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (var col = 0; col < weeks.length; col++) ...[
                          if (col > 0) const SizedBox(width: gap),
                          Column(
                            children: [
                              for (var row = 0; row < 7; row++) ...[
                                if (row > 0) const SizedBox(height: gap),
                                Container(
                                  width: cell,
                                  height: cell,
                                  decoration: BoxDecoration(
                                    color: widget.scale.colorFor(
                                      widget.countsByDay[HouseTask.dateKeyFor(
                                            weeks[col][row],
                                          )] ??
                                          0,
                                    ),
                                    borderRadius: BorderRadius.circular(2),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: gridW,
                    height: 14,
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        for (var m = 1; m <= 12; m++)
                          if (_HeatmapCard._firstWeekIndexForMonth(
                                weeks,
                                widget.year,
                                m,
                              )
                              case final idx?)
                            Positioned(
                              left: idx * step,
                              child: Text(
                                _HeatmapCard._monthLabels[m - 1],
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w500,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CompletedCard extends StatelessWidget {
  const _CompletedCard({
    required this.periodDays,
    required this.myDone,
    required this.houseDone,
    required this.onPeriodChanged,
  });

  final int periodDays;
  final int myDone;
  final int houseDone;
  final ValueChanged<int> onPeriodChanged;

  @override
  Widget build(BuildContext context) {
    final progress = houseDone <= 0 ? 0.0 : myDone / houseDone;

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.10),
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Tarefas concluídas',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              PopupMenuButton<int>(
                initialValue: periodDays,
                onSelected: onPeriodChanged,
                itemBuilder: (context) => const [
                  PopupMenuItem(value: 7, child: Text('7 dias')),
                  PopupMenuItem(value: 30, child: Text('30 dias')),
                  PopupMenuItem(value: 90, child: Text('90 dias')),
                ],
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '$periodDays dias',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const Icon(
                        Icons.expand_more,
                        size: 16,
                        color: AppColors.textSecondary,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              SizedBox(
                width: 64,
                height: 64,
                child: CustomPaint(
                  painter: _DonutPainter(progress: progress),
                ),
              ),
              const SizedBox(width: 18),
              Expanded(
                child: myDone == 0
                    ? const Text(
                        'Nenhuma tarefa',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSecondary,
                        ),
                      )
                    : Text(
                        '$myDone ${myDone == 1 ? 'conclusão sua' : 'conclusões suas'}'
                        '${houseDone > 0 ? ' · ${(progress * 100).round()}% da casa' : ''}',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DonutPainter extends CustomPainter {
  _DonutPainter({required this.progress});

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 4;
    const stroke = 10.0;

    final track = Paint()
      ..color = AppColors.primary.withValues(alpha: 0.12)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(center, radius, track);

    if (progress <= 0) return;

    final arc = Paint()
      ..color = AppColors.primary
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 2,
      2 * math.pi * progress.clamp(0.0, 1.0),
      false,
      arc,
    );
  }

  @override
  bool shouldRepaint(covariant _DonutPainter oldDelegate) =>
      oldDelegate.progress != progress;
}
