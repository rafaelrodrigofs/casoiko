import 'package:flutter/material.dart';
import 'package:casoiko/theme/app_colors.dart';

import '../../../models/house_task.dart';
import '../../../utils/task_dates.dart';

/// Faixa da semana com progresso por dia — seleciona a data ao tocar.
class TaskDateHeader extends StatelessWidget {
  const TaskDateHeader({
    super.key,
    required this.selectedDate,
    required this.weekStart,
    required this.tasks,
    required this.weekChecks,
    required this.onDateSelected,
    required this.onWeekChanged,
  });

  final DateTime selectedDate;
  final DateTime weekStart;
  final List<HouseTask> tasks;
  final List<TaskCheck> weekChecks;
  final ValueChanged<DateTime> onDateSelected;
  final ValueChanged<int> onWeekChanged;

  @override
  Widget build(BuildContext context) {
    final checksByDate = <String, Set<String>>{};
    for (final c in weekChecks) {
      checksByDate.putIfAbsent(c.dateKey, () => {}).add(c.taskId);
    }

    return Row(
      children: [
        IconButton(
          onPressed: () => onWeekChanged(-1),
          icon: const Icon(Icons.chevron_left, size: 20),
          color: AppColors.textSecondary,
          visualDensity: VisualDensity.compact,
        ),
        Expanded(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(7, (i) {
              final day = weekStart.add(Duration(days: i));
              final dateKey = HouseTask.dateKeyFor(day);
              final dayTasks =
                  tasks.where((t) => t.isVisibleOn(day)).toList();
              final doneIds = checksByDate[dateKey] ?? {};
              final progress = TaskDates.progressForDay(
                totalTasks: dayTasks.length,
                doneTasks: dayTasks
                    .where((t) => doneIds.contains(t.id))
                    .length,
              );
              final selected = TaskDates.isSameDay(day, selectedDate);
              final isToday = TaskDates.isToday(day);

              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2),
                  child: _WeekDayCell(
                    weekLabel: TaskDates.weekDayLabel(day),
                    dayNumber: TaskDates.dayNumber(day),
                    progress: progress,
                    selected: selected,
                    isToday: isToday,
                    onTap: () => onDateSelected(day),
                  ),
                ),
              );
            }),
          ),
        ),
        IconButton(
          onPressed: () => onWeekChanged(1),
          icon: const Icon(Icons.chevron_right, size: 20),
          color: AppColors.textSecondary,
          visualDensity: VisualDensity.compact,
        ),
      ],
    );
  }
}

class _WeekDayCell extends StatelessWidget {
  const _WeekDayCell({
    required this.weekLabel,
    required this.dayNumber,
    required this.progress,
    required this.selected,
    required this.isToday,
    required this.onTap,
  });

  final String weekLabel;
  final String dayNumber;
  final double progress;
  final bool selected;
  final bool isToday;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = TaskDates.progressColor(progress);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: selected
                ? AppColors.primary.withValues(alpha: 0.12)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected
                  ? AppColors.primary
                  : isToday
                      ? AppColors.primary.withValues(alpha: 0.35)
                      : Colors.transparent,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Column(
            children: [
              Text(
                weekLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: selected
                      ? AppColors.primary
                      : AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                dayNumber,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: selected
                      ? AppColors.primary
                      : AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(2),
                child: LinearProgressIndicator(
                  value: progress < 0 ? null : progress,
                  minHeight: 3,
                  backgroundColor: AppColors.border,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
