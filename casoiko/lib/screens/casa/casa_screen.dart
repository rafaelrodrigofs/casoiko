import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:casoiko/theme/app_colors.dart';

import '../../models/finance_transaction.dart';
import '../../models/house_task.dart';
import '../../services/auth_service.dart';
import '../../services/finance_service.dart';
import '../../services/grouped_notification_manager.dart';
import '../../services/house_service.dart';
import '../../services/notification_service.dart';
import '../../services/overlay_service.dart';
import '../../services/task_service.dart';
import '../../utils/task_categories.dart';
import '../../utils/task_dates.dart';
import 'task_form_sheet.dart';
import 'widgets/backlog_alert_card.dart';
import 'widgets/casa_hero_header.dart';
import '../../widgets/shell_tab_bar.dart';
import 'widgets/proof_video_player.dart';
import 'widgets/task_date_header.dart';

class CasaScreen extends StatefulWidget {
  const CasaScreen({super.key, required this.authService});

  final AuthService authService;

  @override
  State<CasaScreen> createState() => _CasaScreenState();
}

class _CasaScreenState extends State<CasaScreen> {
  final _houseService = HouseService();
  final _taskService = TaskService();
  final _financeService = FinanceService();

  late final Future<String> _houseIdFuture;
  String? _filterUid;
  int? _lastTasksSignature;

  DateTime _selectedDate = TaskDates.today;
  late DateTime _weekStart =
      TaskService.weekRangeKeys(TaskDates.today).weekStart;
  DateTime _calendarMonth = TaskDates.monthStart(TaskDates.today);
  bool _calendarExpanded = false;

  String get _selectedDateKey => HouseTask.dateKeyFor(_selectedDate);

  bool get _canCompleteOnSelectedDate => !TaskDates.isFutureDay(_selectedDate);

  String get _healthDateLabel {
    if (TaskDates.isToday(_selectedDate)) return 'hoje';
    if (TaskDates.isYesterday(_selectedDate)) return 'ontem';
    return TaskDates.labelFor(_selectedDate).toLowerCase();
  }

  void _selectDate(DateTime date) {
    final normalized = TaskDates.dateOnly(date);
    setState(() {
      _selectedDate = normalized;
      _weekStart = TaskService.weekRangeKeys(normalized).weekStart;
      _calendarMonth = TaskDates.monthStart(normalized);
      _calendarExpanded = false;
    });
  }

  void _changeWeek(int delta) {
    setState(() {
      _weekStart = _weekStart.add(Duration(days: 7 * delta));
    });
  }

  void _changeMonth(int delta) {
    setState(() {
      _calendarMonth = DateTime(
        _calendarMonth.year,
        _calendarMonth.month + delta,
        1,
      );
    });
  }

  @override
  void initState() {
    super.initState();
    final user = widget.authService.currentUser;
    _houseIdFuture = user != null
        ? _houseService.ensureUserRegistered(user)
        : Future.value(HouseService.defaultHouseId);
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await NotificationService.instance.requestPermissions();
      await OverlayService.instance.hide();
    });
    // Abriu a tela da casa: limpa a notificacao agrupada de tarefas.
    GroupedNotificationManager.instance.clearTasks();
  }

  /// Reagenda os lembretes locais sempre que a lista de tarefas mudar.
  void _syncReminders(List<HouseTask> tasks) {
    final signature = Object.hashAll(
      tasks.map(
        (t) => Object.hash(
          t.id,
          t.time,
          t.repeat,
          t.repeatInterval,
          t.priority,
          t.assigneeUid,
          t.durationType,
          t.durationCount,
          t.durationUntil,
          Object.hashAll(t.weekdays),
          Object.hashAll(t.monthDays),
          Object.hashAll(t.yearMonths),
        ),
      ),
    );
    if (signature == _lastTasksSignature) return;
    _lastTasksSignature = signature;

    final uid = widget.authService.currentUser?.uid ?? '';
    NotificationService.instance.syncTasks(tasks, uid);
  }

  Future<void> _openTaskForm(
    String houseId,
    List<HouseMember> members, {
    HouseTask? task,
  }) async {
    final result = await showModalBottomSheet<TaskInput>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => TaskFormSheet(
        members: members,
        currentUid: widget.authService.currentUser?.uid ?? '',
        task: task,
      ),
    );
    if (result == null) return;

    if (task != null) {
      await _taskService.updateTask(
        taskId: task.id,
        title: result.title,
        description: result.description,
        categoryId: result.categoryId,
        assigneeUid: result.assigneeUid,
        assigneeName: result.assigneeName,
        time: result.time,
        priority: result.priority,
        repeatConfig: result.repeatConfig,
        subtasks: result.subtasks,
      );
    } else {
      await _taskService.addTask(
        houseId: houseId,
        title: result.title,
        description: result.description,
        categoryId: result.categoryId,
        assigneeUid: result.assigneeUid,
        assigneeName: result.assigneeName,
        time: result.time,
        priority: result.priority,
        repeatConfig: result.repeatConfig,
        subtasks: result.subtasks,
      );
    }
  }

  Future<void> _completeTask(
    String houseId,
    HouseTask task,
    TaskCheck? existingCheck,
  ) async {
    final user = widget.authService.currentUser;
    if (user == null) return;

    if (existingCheck != null) {
      await _taskService.undoComplete(existingCheck.id);
      return;
    }

    if (task.subtasks.isNotEmpty && !task.allSubtasksDone) {
      final proceed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Subtarefas pendentes'),
          content: Text(
            'Ainda faltam ${task.subtasks.length - task.subtasksDone} '
            'subtarefa(s). Concluir mesmo assim?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Voltar'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Concluir'),
            ),
          ],
        ),
      );
      if (proceed != true) return;
    }

    if (!mounted) return;

    final proof = await showModalBottomSheet<TaskCompleteInput>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => TaskCompleteSheet(taskTitle: task.title),
    );
    if (proof == null) return;

    await _taskService.completeTask(
      houseId: houseId,
      taskId: task.id,
      dateKey: _selectedDateKey,
      doneBy: user.uid,
      doneByName: user.displayName ?? 'Morador',
      proofPhotoBase64: proof.proofPhotoBase64,
      proofVideoBase64: proof.proofVideoBase64,
    );
  }

  Future<void> _confirmDeleteTask(HouseTask task) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Apagar "${task.title}"?'),
        content: const Text(
          'A tarefa será removida para todos. '
          'Conclusões registradas também somem.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red[400]),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Apagar'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await _taskService.deleteTask(task.id);
    }
  }

  Future<void> _openTaskDetail(
    String houseId,
    HouseTask task,
    List<HouseMember> members,
    TaskCheck? check,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StreamBuilder<HouseTask?>(
        stream: _taskService.taskStream(task.id),
        initialData: task,
        builder: (context, snap) {
          final liveTask = snap.data ?? task;
          return _TaskDetailSheet(
            task: liveTask,
            check: check,
            canComplete: _canCompleteOnSelectedDate,
            onEdit: () {
              Navigator.of(context).pop();
              _openTaskForm(houseId, members, task: liveTask);
            },
            onToggleSubtask: (subtaskId, done) =>
                _taskService.updateSubtaskDone(
              taskId: liveTask.id,
              subtaskId: subtaskId,
              done: done,
            ),
            onComplete: () {
              Navigator.of(context).pop();
              _completeTask(houseId, liveTask, check);
            },
            onDelete: () async {
              Navigator.of(context).pop();
              await _confirmDeleteTask(liveTask);
            },
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<String>(
      future: _houseIdFuture,
      builder: (context, houseSnap) {
        if (houseSnap.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final houseId = houseSnap.data ?? HouseService.defaultHouseId;

        return StreamBuilder<List<HouseMember>>(
          stream: _financeService.membersStream(houseId),
          builder: (context, membersSnap) {
            final members = membersSnap.data ?? [];

            return StreamBuilder<List<HouseTask>>(
              stream: _taskService.tasksStream(houseId),
              builder: (context, tasksSnap) {
                final tasks = tasksSnap.data ?? [];

                if (tasksSnap.hasData) {
                  _syncReminders(tasks);
                }

                return StreamBuilder<List<TaskCheck>>(
                  stream: _taskService.checksStream(houseId, _selectedDateKey),
                  builder: (context, checksSnap) {
                    final checks = checksSnap.data ?? [];
                    final checkByTaskId = {
                      for (final c in checks) c.taskId: c,
                    };

                    final weekRange = TaskService.weekRangeKeys(_weekStart);
                    final backlogRange = TaskService.backlogRangeKeys();
                    var rangeStart = backlogRange.startKey;
                    if (weekRange.startKey.compareTo(rangeStart) < 0) {
                      rangeStart = weekRange.startKey;
                    }
                    var rangeEnd = weekRange.endKey;
                    if (_calendarExpanded) {
                      final monthRange =
                          TaskService.monthRangeKeys(_calendarMonth);
                      if (monthRange.startKey.compareTo(rangeStart) < 0) {
                        rangeStart = monthRange.startKey;
                      }
                      if (monthRange.endKey.compareTo(rangeEnd) > 0) {
                        rangeEnd = monthRange.endKey;
                      }
                    }

                    return StreamBuilder<List<TaskCheck>>(
                      stream: _taskService.checksStreamForRange(
                        houseId,
                        rangeStart,
                        rangeEnd,
                      ),
                      builder: (context, rangeSnap) {
                        final rangeChecks = rangeSnap.data ?? [];

                        final dayTasks = tasks
                            .where((t) => t.isVisibleOn(_selectedDate))
                            .toList();
                        final doneCount = dayTasks
                            .where((t) => checkByTaskId.containsKey(t.id))
                            .length;
                        final pendingCount = dayTasks.length - doneCount;
                        final progress = dayTasks.isEmpty
                            ? 0.0
                            : doneCount / dayTasks.length;

                        final backlogInfo = TaskDates.isToday(_selectedDate)
                            ? BacklogInfo.compute(
                                tasks: tasks,
                                backlogChecks: rangeChecks,
                              )
                            : const BacklogInfo(
                                missedCount: 0,
                                mostRecentDay: null,
                                yesterdayCount: 0,
                              );

                        var visibleTasks = dayTasks;
                        if (_filterUid != null) {
                          visibleTasks = dayTasks
                              .where((t) => t.assigneeUid == _filterUid)
                              .toList();
                        }

                        final grouped = <String, List<HouseTask>>{};
                        for (final period in kTaskPeriodOrder) {
                          grouped[period] = [];
                        }
                        for (final task in visibleTasks) {
                          grouped
                              .putIfAbsent(task.periodLabel, () => [])
                              .add(task);
                        }

                        final topPadding = MediaQuery.paddingOf(context).top;
                        final heroExpanded = casaHeroExpandedHeight();
                        final heroCollapsed = casaHeroCollapsedHeight();
                        final heroExpandedEffective =
                            casaHeroEffectiveExpandedHeight(topPadding);
                        final heroCollapsedEffective =
                            casaHeroEffectiveCollapsedHeight(topPadding);

                        return Scaffold(
                          backgroundColor: AppColors.background,
                          body: CustomScrollView(
                            slivers: [
                              SliverAppBar(
                                pinned: true,
                                expandedHeight: heroExpanded,
                                collapsedHeight: heroCollapsed,
                                toolbarHeight: kShellTabBarHeight,
                                elevation: 0,
                                scrolledUnderElevation: 0,
                                automaticallyImplyLeading: false,
                                forceMaterialTransparency: true,
                                backgroundColor: Colors.transparent,
                                surfaceTintColor: Colors.transparent,
                                shape: const RoundedRectangleBorder(
                                  borderRadius: BorderRadius.vertical(
                                    bottom: Radius.circular(24),
                                  ),
                                ),
                                stretch: false,
                                flexibleSpace: LayoutBuilder(
                                  builder: (context, constraints) {
                                    final range =
                                        heroExpandedEffective -
                                            heroCollapsedEffective;
                                    final collapseT = range <= 0
                                        ? 1.0
                                        : (1 -
                                                ((constraints.maxHeight -
                                                        heroCollapsedEffective) /
                                                    range))
                                            .clamp(0.0, 1.0);
                                    return CasaHeroHeader(
                                      collapseT: collapseT,
                                      progress: progress,
                                      pending: pendingCount,
                                      done: doneCount,
                                      total: dayTasks.length,
                                      dateLabel: _healthDateLabel,
                                      onSignOut: () =>
                                          widget.authService.signOut(),
                                      topPadding: topPadding,
                                    );
                                  },
                                ),
                              ),
                              SliverPadding(
                                padding: const EdgeInsets.fromLTRB(
                                  16,
                                  16,
                                  16,
                                  100,
                                ),
                                sliver: SliverList(
                                  delegate: SliverChildListDelegate([
                                    _MemberFilter(
                                      members: members,
                                      selectedUid: _filterUid,
                                      onSelected: (uid) =>
                                          setState(() => _filterUid = uid),
                                    ),
                                    const SizedBox(height: 16),
                                    TaskCalendarHeader(
                                      selectedDate: _selectedDate,
                                      weekStart: _weekStart,
                                      calendarMonth: _calendarMonth,
                                      tasks: tasks,
                                      checks: rangeChecks,
                                      onDateSelected: _selectDate,
                                      onWeekChanged: _changeWeek,
                                      onMonthChanged: _changeMonth,
                                      onExpansionChanged: (isMonth) {
                                        setState(() {
                                          _calendarExpanded = isMonth;
                                          if (isMonth) {
                                            _calendarMonth = TaskDates
                                                .monthStart(_selectedDate);
                                          }
                                        });
                                      },
                                    ),
                                    const SizedBox(height: 12),
                                    if (TaskDates.isToday(_selectedDate))
                                      BacklogAlertCard(
                                        info: backlogInfo,
                                        onTap: () {
                                          final day =
                                              backlogInfo.mostRecentDay;
                                          if (day != null) _selectDate(day);
                                        },
                                      ),
                                    const SizedBox(height: 16),
                                    if (visibleTasks.isEmpty)
                                      _EmptyTasksHint(
                                        isFuture: TaskDates.isFutureDay(
                                          _selectedDate,
                                        ),
                                      )
                                    else
                                      for (final period in kTaskPeriodOrder) ...[
                                        if ((grouped[period] ?? []).isNotEmpty) ...[
                                          _PeriodHeader(label: period),
                                          ...(grouped[period]!..sort((a, b) {
                                            final aDone = checkByTaskId
                                                .containsKey(a.id);
                                            final bDone = checkByTaskId
                                                .containsKey(b.id);
                                            if (aDone != bDone) {
                                              return aDone ? 1 : -1;
                                            }
                                            return a.time.compareTo(b.time);
                                          }))
                                              .map(
                                            (task) => _TaskCard(
                                              key: ValueKey(task.id),
                                              task: task,
                                              check: checkByTaskId[task.id],
                                              canComplete:
                                                  _canCompleteOnSelectedDate,
                                              onTap: () => _openTaskDetail(
                                                houseId,
                                                task,
                                                members,
                                                checkByTaskId[task.id],
                                              ),
                                              onComplete: () => _completeTask(
                                                houseId,
                                                task,
                                                checkByTaskId[task.id],
                                              ),
                                              onDelete: () =>
                                                  _confirmDeleteTask(task),
                                            ),
                                          ),
                                          const SizedBox(height: 8),
                                        ],
                                      ],
                                  ]),
                                ),
                              ),
                            ],
                          ),
                          floatingActionButton: FloatingActionButton(
                            tooltip: 'Nova tarefa',
                            onPressed: members.isEmpty
                                ? null
                                : () => _openTaskForm(houseId, members),
                            child: const Icon(Icons.add),
                          ),
                        );
                      },
                    );
                  },
                );
              },
            );
          },
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

class _MemberFilter extends StatelessWidget {
  const _MemberFilter({
    required this.members,
    required this.selectedUid,
    required this.onSelected,
  });

  final List<HouseMember> members;
  final String? selectedUid;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _FilterChip(
            label: 'Todos',
            selected: selectedUid == null,
            onTap: () => onSelected(null),
          ),
          const SizedBox(width: 8),
          ...members.map(
            (m) => Padding(
              padding: const EdgeInsets.only(right: 8),
              child: _FilterChip(
                label: m.firstName,
                photoUrl: m.photoUrl,
                selected: selectedUid == m.uid,
                onTap: () => onSelected(m.uid),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.photoUrl,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final String? photoUrl;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: selected
                ? AppColors.primary.withValues(alpha: 0.12)
                : Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: selected ? AppColors.primary : AppColors.border,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (photoUrl != null && photoUrl!.isNotEmpty)
                CircleAvatar(
                  radius: 12,
                  backgroundImage: NetworkImage(photoUrl!),
                )
              else if (photoUrl != null)
                CircleAvatar(
                  radius: 12,
                  backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                  child: Text(
                    label.isNotEmpty ? label[0] : '?',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              if (photoUrl != null) const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color:
                      selected ? AppColors.primary : AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PeriodHeader extends StatelessWidget {
  const _PeriodHeader({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, top: 8, bottom: 10),
      child: Text(
        label.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.8,
          color: AppColors.textSecondary,
        ),
      ),
    );
  }
}

class _TaskCard extends StatelessWidget {
  const _TaskCard({
    super.key,
    required this.task,
    required this.check,
    required this.canComplete,
    required this.onTap,
    required this.onComplete,
    required this.onDelete,
  });

  final HouseTask task;
  final TaskCheck? check;
  final bool canComplete;
  final VoidCallback onTap;
  final VoidCallback onComplete;
  final Future<void> Function() onDelete;

  @override
  Widget build(BuildContext context) {
    final category = taskCategoryFor(task.categoryId);
    final done = check != null;

    return Dismissible(
      key: ValueKey(task.id),
      direction: DismissDirection.endToStart,
      confirmDismiss: (_) async {
        await onDelete();
        return false;
      },
      background: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: Colors.red[400],
          borderRadius: BorderRadius.circular(16),
        ),
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        child: const Icon(Icons.delete_outline, color: Colors.white),
      ),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: done
              ? AppColors.primary.withValues(alpha: 0.06)
              : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: done
                ? AppColors.primary.withValues(alpha: 0.3)
                : AppColors.border,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
              child: Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: category.color.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(category.icon, color: category.color, size: 28),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          task.title,
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: done
                                ? AppColors.textSecondary
                                : AppColors.textPrimary,
                            decoration:
                                done ? TextDecoration.lineThrough : null,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            if (task.time.isNotEmpty) ...[
                              Icon(
                                Icons.schedule,
                                size: 13,
                                color: AppColors.textSecondary
                                    .withValues(alpha: 0.7),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                task.time,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary
                                      .withValues(alpha: 0.8),
                                ),
                              ),
                              const SizedBox(width: 8),
                            ],
                            Text(
                              task.assigneeName.split(' ').first,
                              style: TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary
                                    .withValues(alpha: 0.8),
                              ),
                            ),
                            if (task.subtasks.isNotEmpty) ...[
                              const SizedBox(width: 8),
                              Text(
                                '${task.subtasksDone}/${task.subtasks.length}',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: category.color,
                                ),
                              ),
                            ],
                            if (check?.hasProof == true) ...[
                              const SizedBox(width: 6),
                              const Icon(
                                Icons.verified_outlined,
                                size: 14,
                                color: AppColors.primary,
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (canComplete || done)
                    Material(
                      color: done
                          ? AppColors.primary.withValues(alpha: 0.15)
                          : AppColors.primarySoft,
                      shape: const CircleBorder(),
                      child: InkWell(
                        customBorder: const CircleBorder(),
                        onTap: canComplete ? onComplete : null,
                        child: SizedBox(
                          width: 56,
                          height: 56,
                          child: Icon(
                            done
                                ? Icons.check_circle
                                : Icons.check_circle_outline,
                            size: 32,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    )
                  else
                    const SizedBox(
                      width: 56,
                      height: 56,
                      child: Icon(
                        Icons.schedule,
                        size: 28,
                        color: AppColors.textSecondary,
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TaskDetailSheet extends StatelessWidget {
  const _TaskDetailSheet({
    required this.task,
    required this.check,
    required this.canComplete,
    required this.onEdit,
    required this.onToggleSubtask,
    required this.onComplete,
    required this.onDelete,
  });

  final HouseTask task;
  final TaskCheck? check;
  final bool canComplete;
  final VoidCallback onEdit;
  final void Function(String subtaskId, bool done) onToggleSubtask;
  final VoidCallback onComplete;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final category = taskCategoryFor(task.categoryId);
    final done = check != null;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: category.color.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(category.icon, color: category.color, size: 30),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    task.title,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: onEdit,
                  icon: const Icon(Icons.edit_outlined),
                ),
              ],
            ),
            if (task.description.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                task.description,
                style: const TextStyle(
                  fontSize: 15,
                  color: AppColors.textSecondary,
                  height: 1.4,
                ),
              ),
            ],
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _InfoChip(
                  icon: Icons.person_outline,
                  label: task.assigneeName.split(' ').first,
                ),
                if (task.time.isNotEmpty)
                  _InfoChip(icon: Icons.schedule, label: task.time),
                _InfoChip(icon: category.icon, label: category.name),
              ],
            ),
            if (task.subtasks.isNotEmpty) ...[
              const SizedBox(height: 20),
              Text(
                'Subtarefas (${task.subtasksDone}/${task.subtasks.length})',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              ...task.subtasks.map(
                (s) => CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: s.done,
                  activeColor: AppColors.primary,
                  title: Text(s.title),
                  onChanged: (v) => onToggleSubtask(s.id, v ?? false),
                ),
              ),
            ],
            if (check?.proofPhotoBase64.isNotEmpty == true) ...[
              const SizedBox(height: 16),
              const Text(
                'Prova (foto)',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.memory(
                  base64Decode(check!.proofPhotoBase64),
                  fit: BoxFit.cover,
                ),
              ),
            ],
            if (check?.proofVideoBase64.isNotEmpty == true) ...[
              const SizedBox(height: 16),
              const Text(
                'Prova (vídeo)',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              ProofVideoPlayer(
                videoBase64: check!.proofVideoBase64,
                height: 200,
              ),
            ],
            const SizedBox(height: 24),
            if (canComplete || done)
              SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton.icon(
                  onPressed: canComplete ? onComplete : null,
                  icon: Icon(done ? Icons.undo : Icons.check_circle_outline),
                  label: Text(
                    done ? 'Desfazer conclusao' : 'Marcar como feita',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor:
                        done ? Colors.red[400] : AppColors.primary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              )
            else
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surfaceMuted,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.info_outline, color: AppColors.textSecondary),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Tarefas futuras sao apenas previsao. '
                        'Volte no dia para marcar como feita.',
                        style: TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: OutlinedButton.icon(
                onPressed: onDelete,
                icon: Icon(Icons.delete_outline, color: Colors.red[400]),
                label: Text(
                  'Apagar tarefa',
                  style: TextStyle(
                    color: Colors.red[400],
                    fontWeight: FontWeight.w600,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: Colors.red[300]!),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: AppColors.textSecondary),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyTasksHint extends StatelessWidget {
  const _EmptyTasksHint({this.isFuture = false});

  final bool isFuture;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Icon(
            isFuture ? Icons.event_outlined : Icons.task_alt,
            size: 48,
            color: AppColors.textSecondary,
          ),
          const SizedBox(height: 12),
          Text(
            isFuture ? 'Nada previsto neste dia' : 'Nenhuma tarefa neste dia',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            isFuture
                ? 'As tarefas recorrentes aparecem aqui conforme a rotina.'
                : 'Toque em + Nova tarefa para organizar a rotina da casa.',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 14,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}
