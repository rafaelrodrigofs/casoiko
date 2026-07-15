import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:casoiko/theme/app_colors.dart';

import '../../models/finance_transaction.dart';
import '../../models/house_task.dart';
import '../../services/admin_service.dart';
import '../../services/auth_service.dart';
import '../../services/finance_service.dart';
import '../../services/task_service.dart';
import '../../utils/task_dates.dart';
import '../settings/settings_widgets.dart';

enum AdminCheckFilter { all, mine, orphans, noProof }

class AdminChecksScreen extends StatefulWidget {
  const AdminChecksScreen({
    super.key,
    required this.authService,
    required this.houseId,
    this.initialFilter = AdminCheckFilter.all,
  });

  final AuthService authService;
  final String houseId;
  final AdminCheckFilter initialFilter;

  @override
  State<AdminChecksScreen> createState() => _AdminChecksScreenState();
}

class _AdminChecksScreenState extends State<AdminChecksScreen> {
  late AdminCheckFilter _filter;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _filter = widget.initialFilter;
  }

  @override
  Widget build(BuildContext context) {
    final finance = FinanceService();
    final taskService = TaskService();
    final admin = AdminService();
    final uid = widget.authService.currentUser?.uid ?? '';
    final start = HouseTask.dateKeyFor(
      TaskDates.today.subtract(const Duration(days: 800)),
    );
    final end = HouseTask.dateKeyFor(TaskDates.today);

    return SettingsScaffold(
      title: 'Conclusões',
      child: StreamBuilder<List<HouseMember>>(
        stream: finance.membersStream(widget.houseId),
        builder: (context, membersSnap) {
          final members = membersSnap.data ?? [];
          if (membersSnap.hasData &&
              !AdminService.canManage(members, uid)) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (context.mounted) Navigator.of(context).maybePop();
            });
            return const SizedBox.shrink();
          }

          return StreamBuilder<List<HouseTask>>(
            stream: taskService.tasksStream(widget.houseId),
            builder: (context, tasksSnap) {
              final tasks = tasksSnap.data ?? [];
              final taskById = {for (final t in tasks) t.id: t};
              final taskIds = taskById.keys.toSet();

              return StreamBuilder<List<TaskCheck>>(
                stream: taskService.checksStreamForRange(
                  widget.houseId,
                  start,
                  end,
                ),
                builder: (context, checksSnap) {
                  final all = List<TaskCheck>.from(checksSnap.data ?? [])
                    ..sort((a, b) => b.dateKey.compareTo(a.dateKey));
                  final orphans = AdminService.orphans(tasks, all);

                  final filtered = all.where((c) {
                    switch (_filter) {
                      case AdminCheckFilter.all:
                        return true;
                      case AdminCheckFilter.mine:
                        return c.doneBy == uid;
                      case AdminCheckFilter.orphans:
                        return AdminService.isOrphan(c, taskIds);
                      case AdminCheckFilter.noProof:
                        return !c.hasProof;
                    }
                  }).toList();

                  return Column(
                    children: [
                      Expanded(
                        child: ListView(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
                          children: [
                            const _TipCard(
                              title: 'Por que aparece no Perfil?',
                              body:
                                  'Checks antigos ou sem tarefa ainda entram no anel de 30 dias.',
                            ),
                            const SizedBox(height: 16),
                            const SettingsSectionLabel('FILTROS'),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                for (final f in AdminCheckFilter.values)
                                  ChoiceChip(
                                    label: Text(_filterLabel(f)),
                                    selected: _filter == f,
                                    onSelected: (_) =>
                                        setState(() => _filter = f),
                                    selectedColor: AppColors.primary,
                                    labelStyle: TextStyle(
                                      color: _filter == f
                                          ? Colors.white
                                          : AppColors.textPrimary,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 12,
                                    ),
                                    backgroundColor: AppColors.surface,
                                    side: BorderSide(
                                      color: AppColors.primary
                                          .withValues(alpha: 0.15),
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            const SettingsSectionLabel('ÚLTIMAS CONCLUSÕES'),
                            if (filtered.isEmpty)
                              const Padding(
                                padding: EdgeInsets.symmetric(vertical: 24),
                                child: Text(
                                  'Nenhuma conclusão neste filtro.',
                                  style: TextStyle(
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              )
                            else
                              for (final c in filtered.take(80)) ...[
                                _CheckRow(
                                  check: c,
                                  taskTitle: taskById[c.taskId]?.title,
                                  orphan: AdminService.isOrphan(c, taskIds),
                                ),
                                const SizedBox(height: 8),
                              ],
                          ],
                        ),
                      ),
                      if (orphans.isNotEmpty)
                        SafeArea(
                          top: false,
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            child: SizedBox(
                              width: double.infinity,
                              height: 48,
                              child: FilledButton(
                                style: FilledButton.styleFrom(
                                  backgroundColor: AppColors.danger,
                                ),
                                onPressed: _busy
                                    ? null
                                    : () => _confirmDeleteOrphans(
                                          context,
                                          admin,
                                          orphans,
                                        ),
                                child: _busy
                                    ? const SizedBox(
                                        width: 22,
                                        height: 22,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Colors.white,
                                        ),
                                      )
                                    : Text(
                                        'Remover ${orphans.length} '
                                        '${orphans.length == 1 ? 'órfã' : 'órfãs'}',
                                      ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  );
                },
              );
            },
          );
        },
      ),
    );
  }

  String _filterLabel(AdminCheckFilter f) {
    switch (f) {
      case AdminCheckFilter.all:
        return 'Todas';
      case AdminCheckFilter.mine:
        return 'Suas';
      case AdminCheckFilter.orphans:
        return 'Órfãs';
      case AdminCheckFilter.noProof:
        return 'Sem prova';
    }
  }

  Future<void> _confirmDeleteOrphans(
    BuildContext context,
    AdminService admin,
    List<TaskCheck> orphans,
  ) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remover órfãs?'),
        content: Text(
          'Apagar ${orphans.length} check(s) sem tarefa correspondente?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Remover'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    final messenger = ScaffoldMessenger.of(this.context);
    setState(() => _busy = true);
    try {
      await admin.deleteChecks(orphans.map((c) => c.id).toList());
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text('${orphans.length} órfã(s) removida(s).')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class _TipCard extends StatelessWidget {
  const _TipCard({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.lightbulb_outline, color: AppColors.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  body,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CheckRow extends StatelessWidget {
  const _CheckRow({
    required this.check,
    required this.taskTitle,
    required this.orphan,
  });

  final TaskCheck check;
  final String? taskTitle;
  final bool orphan;

  @override
  Widget build(BuildContext context) {
    final title = orphan
        ? (taskTitle ?? 'task_id deletado')
        : (taskTitle ?? check.taskId);
    final day = _formatDay(check.dateKey);
    final meta =
        '${check.doneByName.isEmpty ? 'Alguém' : check.doneByName} · $day'
        '${orphan ? ' · sem tarefa' : ' · ok'}';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  meta,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: orphan
                  ? AppColors.danger.withValues(alpha: 0.12)
                  : AppColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              orphan ? 'Órfã' : 'OK',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: orphan ? AppColors.danger : AppColors.primary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  static String _formatDay(String dateKey) {
    final parts = dateKey.split('-');
    if (parts.length != 3) return dateKey;
    final d = DateTime(
      int.parse(parts[0]),
      int.parse(parts[1]),
      int.parse(parts[2]),
    );
    return DateFormat('d MMM', 'pt_BR').format(d);
  }
}
