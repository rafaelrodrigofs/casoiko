import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:casoiko/theme/app_colors.dart';

import '../../models/finance_transaction.dart';
import '../../models/house_task.dart';
import '../../services/admin_service.dart';
import '../../services/auth_service.dart';
import '../../services/finance_service.dart';
import '../../services/task_service.dart';
import '../settings/settings_widgets.dart';

class AdminVizScreen extends StatelessWidget {
  const AdminVizScreen({
    super.key,
    required this.authService,
    required this.houseId,
  });

  final AuthService authService;
  final String houseId;

  @override
  Widget build(BuildContext context) {
    final finance = FinanceService();
    final tasks = TaskService();
    final uid = authService.currentUser?.uid;
    final period = TaskService.lastDaysRangeKeys(30);

    return SettingsScaffold(
      title: 'Visualizações',
      child: StreamBuilder<List<HouseMember>>(
        stream: finance.membersStream(houseId),
        builder: (context, membersSnap) {
          final members = membersSnap.data ?? [];
          if (membersSnap.hasData && !AdminService.canManage(members, uid)) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (context.mounted) Navigator.of(context).maybePop();
            });
            return const SizedBox.shrink();
          }

          return StreamBuilder<List<HouseTask>>(
            stream: tasks.tasksStream(houseId),
            builder: (context, tasksSnap) {
              final taskList = tasksSnap.data ?? [];
              return StreamBuilder<List<TaskCheck>>(
                stream: tasks.checksStreamForRange(
                  houseId,
                  period.startKey,
                  period.endKey,
                ),
                builder: (context, checksSnap) {
                  final checks = checksSnap.data ?? [];
                  final orphans = AdminService.orphans(taskList, checks);
                  final byMember = <String, ({String name, int count})>{};
                  for (final c in checks) {
                    final key = c.doneBy;
                    final prev = byMember[key];
                    byMember[key] = (
                      name: c.doneByName.isNotEmpty
                          ? c.doneByName
                          : (prev?.name ?? 'Alguém'),
                      count: (prev?.count ?? 0) + 1,
                    );
                  }
                  final memberRank = byMember.entries.toList()
                    ..sort((a, b) => b.value.count.compareTo(a.value.count));
                  final byDay = <String, int>{};
                  for (final c in checks) {
                    byDay[c.dateKey] = (byDay[c.dateKey] ?? 0) + 1;
                  }
                  final topDays = byDay.entries.toList()
                    ..sort((a, b) => b.value.compareTo(a.value));
                  final top = topDays.take(5).toList();
                  final total = checks.length;

                  return ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                    children: [
                      const SettingsSectionLabel('RESUMO DA CASA'),
                      Row(
                        children: [
                          Expanded(
                            child: _MiniStat(
                              label: 'Tarefas ativas',
                              value: '${taskList.length}',
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _MiniStat(
                              label: 'Checks (30d)',
                              value: '$total',
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: _MiniStat(
                              label: 'Checks órfãos',
                              value: '${orphans.length}',
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _MiniStat(
                              label: 'Membros',
                              value: '${members.length}',
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      const SettingsSectionLabel('POR MEMBRO (30 DIAS)'),
                      if (memberRank.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Text(
                            'Nenhuma conclusão no período.',
                            style: TextStyle(color: AppColors.textSecondary),
                          ),
                        )
                      else
                        for (final e in memberRank) ...[
                          _ListCard(
                            title: e.value.name,
                            meta: total == 0
                                ? '${e.value.count} conclusões'
                                : '${e.value.count} conclusões · '
                                    '${(e.value.count * 100 / total).round()}%',
                            badge: e.key == uid ? 'Você' : null,
                          ),
                          const SizedBox(height: 8),
                        ],
                      const SizedBox(height: 12),
                      const SettingsSectionLabel('DIAS COM MAIS ATIVIDADE'),
                      if (top.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Text(
                            'Sem atividade nos últimos 30 dias.',
                            style: TextStyle(color: AppColors.textSecondary),
                          ),
                        )
                      else
                        for (final e in top) ...[
                          _ListCard(
                            title: _formatDay(e.key),
                            meta:
                                '${e.value} ${e.value == 1 ? 'tarefa concluída' : 'tarefas concluídas'}',
                          ),
                          const SizedBox(height: 8),
                        ],
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

  static String _formatDay(String dateKey) {
    final parts = dateKey.split('-');
    if (parts.length != 3) return dateKey;
    final d = DateTime(
      int.parse(parts[0]),
      int.parse(parts[1]),
      int.parse(parts[2]),
    );
    return DateFormat("d MMM yyyy", 'pt_BR').format(d);
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 72,
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.10),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: AppColors.textSecondary,
            ),
          ),
          const Spacer(),
          Text(
            value,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _ListCard extends StatelessWidget {
  const _ListCard({
    required this.title,
    required this.meta,
    this.badge,
  });

  final String title;
  final String meta;
  final String? badge;

  @override
  Widget build(BuildContext context) {
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
          if (badge != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                badge!,
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
