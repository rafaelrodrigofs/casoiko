import 'package:flutter/material.dart';
import 'package:casoiko/theme/app_colors.dart';

import '../../../models/house_task.dart';
import '../../../utils/task_dates.dart';

/// Calendario expansivel: semana OU mes, com drag interativo estilo pull.
class TaskCalendarHeader extends StatefulWidget {
  const TaskCalendarHeader({
    super.key,
    required this.selectedDate,
    required this.weekStart,
    required this.calendarMonth,
    required this.tasks,
    required this.checks,
    required this.onDateSelected,
    required this.onWeekChanged,
    required this.onMonthChanged,
    this.onExpansionChanged,
  });

  final DateTime selectedDate;
  final DateTime weekStart;
  final DateTime calendarMonth;
  final List<HouseTask> tasks;
  final List<TaskCheck> checks;
  final ValueChanged<DateTime> onDateSelected;
  final ValueChanged<int> onWeekChanged;
  final ValueChanged<int> onMonthChanged;
  final ValueChanged<bool>? onExpansionChanged;

  @override
  State<TaskCalendarHeader> createState() => _TaskCalendarHeaderState();
}

class _TaskCalendarHeaderState extends State<TaskCalendarHeader>
    with SingleTickerProviderStateMixin {
  static const _monthRevealExtent = 336.0;
  static const _weekHeight = 72.0;
  static const _monthHeight = 336.0;
  static const _snapThreshold = 0.45;

  late final AnimationController _expandController;
  double _dragProgress = 0;
  bool _wasMonthView = false;

  @override
  void initState() {
    super.initState();
    _expandController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 250),
    );
    _expandController.addListener(_onControllerTick);
  }

  @override
  void dispose() {
    _expandController.removeListener(_onControllerTick);
    _expandController.dispose();
    super.dispose();
  }

  void _onControllerTick() {
    setState(() {});
    _syncExpansionCallback();
  }

  void _syncExpansionCallback() {
    final isMonth = _expandProgress >= 0.95;
    if (isMonth != _wasMonthView) {
      _wasMonthView = isMonth;
      widget.onExpansionChanged?.call(isMonth);
    }
  }

  double get _expandProgress =>
      (_expandController.value + _dragProgress).clamp(0.0, 1.0);

  Map<String, Set<String>> get _checksByDate {
    final map = <String, Set<String>>{};
    for (final c in widget.checks) {
      map.putIfAbsent(c.dateKey, () => {}).add(c.taskId);
    }
    return map;
  }

  double _progressFor(DateTime day) {
    final dayTasks = widget.tasks.where((t) => t.isVisibleOn(day)).toList();
    final doneIds = _checksByDate[HouseTask.dateKeyFor(day)] ?? {};
    return TaskDates.progressForDay(
      totalTasks: dayTasks.length,
      doneTasks: dayTasks.where((t) => doneIds.contains(t.id)).length,
    );
  }

  void _onDragUpdate(DragUpdateDetails details) {
    setState(() {
      _dragProgress += details.delta.dy / _monthRevealExtent;
    });
    _syncExpansionCallback();
  }

  void _onDragEnd(DragEndDetails details) {
    final velocity = details.primaryVelocity ?? 0;
    final current = _expandProgress;

    final double target;
    if (velocity > 500) {
      target = 1;
    } else if (velocity < -500) {
      target = 0;
    } else {
      target = current >= _snapThreshold ? 1 : 0;
    }

    _expandController.value = current;
    setState(() => _dragProgress = 0);
    _expandController.animateTo(
      target,
      curve: Curves.easeOutCubic,
    );
  }

  void _collapseToWeek() {
    _expandController.animateTo(0, curve: Curves.easeOutCubic);
  }

  void _selectDay(DateTime day) {
    widget.onDateSelected(day);
    if (_expandProgress > 0) {
      _collapseToWeek();
    }
  }

  Widget _navRow({
    required Widget child,
    required VoidCallback onPrev,
    required VoidCallback onNext,
  }) {
    return Row(
      children: [
        IconButton(
          onPressed: onPrev,
          icon: const Icon(Icons.chevron_left, size: 20),
          color: AppColors.textSecondary,
          visualDensity: VisualDensity.compact,
        ),
        Expanded(child: child),
        IconButton(
          onPressed: onNext,
          icon: const Icon(Icons.chevron_right, size: 20),
          color: AppColors.textSecondary,
          visualDensity: VisualDensity.compact,
        ),
      ],
    );
  }

  Widget _buildWeekRow() {
    return _navRow(
      onPrev: () => widget.onWeekChanged(-1),
      onNext: () => widget.onWeekChanged(1),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: List.generate(7, (i) {
          final day = widget.weekStart.add(Duration(days: i));
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: _WeekDayCell(
                weekLabel: TaskDates.weekDayLabel(day),
                dayNumber: TaskDates.dayNumber(day),
                progress: _progressFor(day),
                selected: TaskDates.isSameDay(day, widget.selectedDate),
                isToday: TaskDates.isToday(day),
                onTap: () => _selectDay(day),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildMonthPanel() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _navRow(
          onPrev: () => widget.onMonthChanged(-1),
          onNext: () => widget.onMonthChanged(1),
          child: Text(
            TaskDates.monthTitle(widget.calendarMonth),
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
        ),
        const SizedBox(height: 8),
        _MonthGrid(
          calendarMonth: widget.calendarMonth,
          selectedDate: widget.selectedDate,
          progressFor: _progressFor,
          onDayTap: _selectDay,
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final progress = _expandProgress;
    final weekOpacity =
        (1 - Curves.easeOut.transform(progress)).clamp(0.0, 1.0);
    final monthOpacity = Curves.easeIn.transform(progress).clamp(0.0, 1.0);
    final contentHeight =
        _weekHeight + progress * (_monthHeight - _weekHeight);

    return GestureDetector(
      onVerticalDragUpdate: _onDragUpdate,
      onVerticalDragEnd: _onDragEnd,
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          SizedBox(
            height: contentHeight,
            child: Stack(
              clipBehavior: Clip.hardEdge,
              children: [
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  height: _monthHeight,
                  child: Opacity(
                    opacity: monthOpacity,
                    child: IgnorePointer(
                      ignoring: progress < 0.5,
                      child: _buildMonthPanel(),
                    ),
                  ),
                ),
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  height: _weekHeight,
                  child: Opacity(
                    opacity: weekOpacity,
                    child: IgnorePointer(
                      ignoring: progress >= 0.5,
                      child: _buildWeekRow(),
                    ),
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

class _MonthGrid extends StatelessWidget {
  const _MonthGrid({
    required this.calendarMonth,
    required this.selectedDate,
    required this.progressFor,
    required this.onDayTap,
  });

  final DateTime calendarMonth;
  final DateTime selectedDate;
  final double Function(DateTime day) progressFor;
  final ValueChanged<DateTime> onDayTap;

  @override
  Widget build(BuildContext context) {
    final days = TaskDates.daysForMonthGrid(calendarMonth);

    return Column(
      children: [
        Row(
          children: TaskDates.monthWeekdayLabels
              .map(
                (label) => Expanded(
                  child: Text(
                    label,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary.withValues(alpha: 0.8),
                    ),
                  ),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 6),
        for (var row = 0; row < 6; row++)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              children: List.generate(7, (col) {
                final day = days[row * 7 + col];
                final inMonth =
                    TaskDates.isSameMonth(day, calendarMonth);
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    child: _MonthDayCell(
                      dayNumber: TaskDates.dayNumber(day),
                      progress: progressFor(day),
                      selected:
                          TaskDates.isSameDay(day, selectedDate),
                      isToday: TaskDates.isToday(day),
                      inMonth: inMonth,
                      onTap: () => onDayTap(day),
                    ),
                  ),
                );
              }),
            ),
          ),
      ],
    );
  }
}

class _MonthDayCell extends StatelessWidget {
  const _MonthDayCell({
    required this.dayNumber,
    required this.progress,
    required this.selected,
    required this.isToday,
    required this.inMonth,
    required this.onTap,
  });

  final String dayNumber;
  final double progress;
  final bool selected;
  final bool isToday;
  final bool inMonth;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = TaskDates.progressColor(progress);
    final textColor = !inMonth
        ? AppColors.textSecondary.withValues(alpha: 0.45)
        : selected
            ? AppColors.primary
            : AppColors.textPrimary;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 6),
          decoration: BoxDecoration(
            color: selected
                ? AppColors.primary.withValues(alpha: 0.12)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
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
                dayNumber,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: textColor,
                ),
              ),
              const SizedBox(height: 4),
              ClipRRect(
                borderRadius: BorderRadius.circular(2),
                child: _DayProgressBar(progress: progress, color: color),
              ),
            ],
          ),
        ),
      ),
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
                child: _DayProgressBar(progress: progress, color: color),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Barra do dia na faixa semanal / grade mensal.
class _DayProgressBar extends StatelessWidget {
  const _DayProgressBar({
    required this.progress,
    required this.color,
  });

  final double progress;
  final Color color;

  @override
  Widget build(BuildContext context) {
    if (progress < 0) {
      return Container(
        height: 3,
        decoration: BoxDecoration(
          color: AppColors.border,
          borderRadius: BorderRadius.circular(2),
        ),
      );
    }

    if (progress >= 0.9) {
      return LinearProgressIndicator(
        value: progress,
        minHeight: 3,
        backgroundColor: AppColors.border,
        color: color,
      );
    }

    if (progress == 0) {
      return LinearProgressIndicator(
        minHeight: 3,
        backgroundColor: AppColors.border,
        color: color,
      );
    }

    return LinearProgressIndicator(
      value: progress,
      minHeight: 3,
      backgroundColor: AppColors.border,
      color: color,
    );
  }
}
