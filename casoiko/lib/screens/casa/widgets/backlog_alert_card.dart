import 'package:flutter/material.dart';

import '../../../models/house_task.dart';
import '../../../utils/task_dates.dart';

/// Resultado do calculo de tarefas atrasadas.
class BacklogInfo {
  const BacklogInfo({
    required this.missedCount,
    required this.mostRecentDay,
    required this.yesterdayCount,
  });

  final int missedCount;
  final DateTime? mostRecentDay;
  final int yesterdayCount;

  static BacklogInfo compute({
    required List<HouseTask> tasks,
    required List<TaskCheck> backlogChecks,
    int lookbackDays = 7,
  }) {
    final today = TaskDates.today;
    final checksByDate = <String, Set<String>>{};
    for (final c in backlogChecks) {
      checksByDate.putIfAbsent(c.dateKey, () => {}).add(c.taskId);
    }

    var totalMissed = 0;
    var yesterdayMissed = 0;
    DateTime? mostRecent;

    for (var i = 1; i <= lookbackDays; i++) {
      final day = today.subtract(Duration(days: i));
      final dateKey = HouseTask.dateKeyFor(day);
      final dayTasks = tasks.where((t) => t.isVisibleOn(day)).toList();
      final doneIds = checksByDate[dateKey] ?? {};
      final missed =
          dayTasks.where((t) => !doneIds.contains(t.id)).length;

      if (missed > 0) {
        totalMissed += missed;
        mostRecent ??= day;
        if (i == 1) yesterdayMissed = missed;
      }
    }

    return BacklogInfo(
      missedCount: totalMissed,
      mostRecentDay: mostRecent,
      yesterdayCount: yesterdayMissed,
    );
  }
}

/// Banner de tarefas nao feitas em dias anteriores (visivel so em "Hoje").
class BacklogAlertCard extends StatelessWidget {
  const BacklogAlertCard({
    super.key,
    required this.info,
    required this.onTap,
  });

  final BacklogInfo info;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    if (info.missedCount <= 0) return const SizedBox.shrink();

    final String message;
    if (info.yesterdayCount > 0 && info.yesterdayCount == info.missedCount) {
      message =
          '${info.yesterdayCount} tarefa${info.yesterdayCount == 1 ? '' : 's'} '
          'nao feita${info.yesterdayCount == 1 ? '' : 's'} ontem';
    } else {
      message =
          '${info.missedCount} tarefa${info.missedCount == 1 ? '' : 's'} '
          'pendente${info.missedCount == 1 ? '' : 's'} dos ultimos dias';
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF7ED),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFFDBA74)),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.warning_amber_rounded,
                  color: Color(0xFFEA580C),
                  size: 22,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    message,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF9A3412),
                    ),
                  ),
                ),
                const Icon(
                  Icons.chevron_right,
                  color: Color(0xFFEA580C),
                  size: 20,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
