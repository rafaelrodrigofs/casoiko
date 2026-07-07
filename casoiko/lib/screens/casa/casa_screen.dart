import 'package:flutter/material.dart';
import 'package:casoiko/theme/app_colors.dart';

import '../../models/house_task.dart';
import '../../services/auth_service.dart';
import '../../services/house_service.dart';
import '../../services/task_service.dart';
import '../../utils/task_categories.dart';
import 'task_form_sheet.dart';

const _periodOrder = ['Manhã', 'Tarde', 'Noite', 'Sem horário'];

class CasaScreen extends StatefulWidget {
  const CasaScreen({super.key, required this.authService});

  final AuthService authService;

  @override
  State<CasaScreen> createState() => _CasaScreenState();
}

class _CasaScreenState extends State<CasaScreen> {
  final _houseService = HouseService();
  final _taskService = TaskService();

  late final Future<String> _houseIdFuture;
  String? _filterUid;

  @override
  void initState() {
    super.initState();
    final user = widget.authService.currentUser;
    _houseIdFuture = user != null
        ? _houseService.ensureUserRegistered(user)
        : Future.value(HouseService.defaultHouseId);
  }

  String get _dateKey => HouseTask.dateKeyFor(DateTime.now());
  String get _currentUid => widget.authService.currentUser?.uid ?? '';

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
        currentUid: _currentUid,
        task: task,
      ),
    );
    if (result == null) return;

    if (task != null) {
      await _taskService.updateTask(
        taskId: task.id,
        title: result.title,
        description: result.description,
        category: result.category,
        assigneeUid: result.assigneeUid,
        assigneeName: result.assigneeName,
        time: result.time,
        priority: result.priority,
        repeat: result.repeat,
        weekdays: result.weekdays,
      );
    } else {
      await _taskService.addTask(
        houseId: houseId,
        title: result.title,
        description: result.description,
        category: result.category,
        assigneeUid: result.assigneeUid,
        assigneeName: result.assigneeName,
        time: result.time,
        priority: result.priority,
        repeat: result.repeat,
        weekdays: result.weekdays,
      );
    }
  }

  Future<void> _confirmDeleteTask(HouseTask task) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Apagar "${task.title}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
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

  Future<void> _toggleTask({
    required String houseId,
    required HouseTask task,
    required bool done,
    String? checkId,
  }) async {
    await _taskService.toggleCheck(
      houseId: houseId,
      taskId: task.id,
      dateKey: _dateKey,
      doneBy: _currentUid,
      done: done,
      checkId: checkId,
    );
  }

  List<HouseTask> _todayTasks(
    List<HouseTask> all,
    Set<String> everCompletedIds,
  ) {
    final today = DateTime.now();
    return all
        .where((t) => t.isDueOn(today, everCompletedIds: everCompletedIds))
        .where((t) => _filterUid == null || t.assigneeUid == _filterUid)
        .toList();
  }

  Map<String, List<HouseTask>> _groupByPeriod(List<HouseTask> tasks) {
    final groups = <String, List<HouseTask>>{};
    for (final period in _periodOrder) {
      groups[period] = [];
    }
    for (final task in tasks) {
      final period = HouseTask.periodForTime(task.time);
      groups.putIfAbsent(period, () => []).add(task);
    }
    return groups;
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
          stream: _taskService.membersStream(houseId),
          builder: (context, membersSnap) {
            final members = membersSnap.data ?? [];

            return StreamBuilder<List<HouseTask>>(
              stream: _taskService.tasksStream(houseId),
              builder: (context, tasksSnap) {
                final allTasks = tasksSnap.data ?? [];

                return StreamBuilder<Set<String>>(
                  stream: _taskService.everCheckedTaskIdsStream(houseId),
                  builder: (context, everSnap) {
                    final everCompleted = everSnap.data ?? {};

                    return StreamBuilder<List<TaskCheck>>(
                      stream: _taskService.checksStream(houseId, _dateKey),
                      builder: (context, checksSnap) {
                        final checks = checksSnap.data ?? [];
                        final checkByTaskId = {
                          for (final c in checks) c.taskId: c,
                        };
                        final todayTasks =
                            _todayTasks(allTasks, everCompleted);
                        final doneCount = todayTasks
                            .where((t) => checkByTaskId.containsKey(t.id))
                            .length;
                        final pendingCount =
                            todayTasks.length - doneCount;
                        final progress = todayTasks.isEmpty
                            ? 0.0
                            : doneCount / todayTasks.length;

                        final groups = _groupByPeriod(todayTasks);
                        final loading = tasksSnap.connectionState ==
                                ConnectionState.waiting &&
                            !tasksSnap.hasData;

                        return Scaffold(
                          appBar: AppBar(
                            title: const Text('Casa'),
                            actions: [
                              IconButton(
                                tooltip: 'Sair',
                                onPressed: () =>
                                    widget.authService.signOut(),
                                icon: const Icon(Icons.logout),
                              ),
                            ],
                          ),
                          body: loading
                              ? const Center(
                                  child: CircularProgressIndicator(),
                                )
                              : ListView(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 12,
                                  ),
                                  children: [
                                    _HouseStateCard(
                                      progress: progress,
                                      pendingCount: pendingCount,
                                      doneCount: doneCount,
                                      totalCount: todayTasks.length,
                                    ),
                                    const SizedBox(height: 16),
                                    _MemberFilter(
                                      members: members,
                                      selectedUid: _filterUid,
                                      onSelected: (uid) =>
                                          setState(() => _filterUid = uid),
                                    ),
                                    const SizedBox(height: 16),
                                    if (todayTasks.isEmpty)
                                      const _EmptyTasksHint()
                                    else
                                      for (final period in _periodOrder)
                                        if ((groups[period] ?? []).isNotEmpty)
                                          ...[
                                            _PeriodHeader(label: period),
                                            ...(groups[period]!).map(
                                              (task) => _TaskCard(
                                                key: ValueKey(task.id),
                                                task: task,
                                                done: checkByTaskId
                                                    .containsKey(task.id),
                                                onToggle: () => _toggleTask(
                                                  houseId: houseId,
                                                  task: task,
                                                  done: !checkByTaskId
                                                      .containsKey(task.id),
                                                  checkId: checkByTaskId[
                                                          task.id]
                                                      ?.id,
                                                ),
                                                onTap: () => _openTaskForm(
                                                  houseId,
                                                  members,
                                                  task: task,
                                                ),
                                                onDelete: () =>
                                                    _confirmDeleteTask(task),
                                              ),
                                            ),
                                            const SizedBox(height: 4),
                                          ],
                                    const SizedBox(height: 80),
                                  ],
                                ),
                          floatingActionButton:
                              FloatingActionButton.extended(
                            onPressed: members.isEmpty
                                ? null
                                : () => _openTaskForm(houseId, members),
                            icon: const Icon(Icons.add),
                            label: const Text('Nova tarefa'),
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
// Widgets internos
// ---------------------------------------------------------------------------

class _HouseStateCard extends StatelessWidget {
  const _HouseStateCard({
    required this.progress,
    required this.pendingCount,
    required this.doneCount,
    required this.totalCount,
  });

  final double progress;
  final int pendingCount;
  final int doneCount;
  final int totalCount;

  @override
  Widget build(BuildContext context) {
    final percent = (progress * 100).round();

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          SizedBox(
            width: 72,
            height: 72,
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 72,
                  height: 72,
                  child: CircularProgressIndicator(
                    value: totalCount == 0 ? 0 : progress,
                    strokeWidth: 6,
                    backgroundColor: AppColors.surfaceMuted,
                    color: AppColors.primary,
                  ),
                ),
                Text(
                  '$percent%',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Estado da casa',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  totalCount == 0
                      ? 'Nenhuma tarefa para hoje'
                      : '$pendingCount pendentes · $doneCount concluídas',
                  style: const TextStyle(
                    fontSize: 13,
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
            (member) => Padding(
              padding: const EdgeInsets.only(right: 8),
              child: _FilterChip(
                label: member.firstName,
                photoUrl: member.photoUrl,
                initial: member.firstName.isNotEmpty
                    ? member.firstName[0]
                    : '?',
                selected: selectedUid == member.uid,
                onTap: () => onSelected(member.uid),
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
    this.initial,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final String? photoUrl;
  final String? initial;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
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
              if (photoUrl != null || initial != null) ...[
                CircleAvatar(
                  radius: 12,
                  backgroundColor: AppColors.surfaceMuted,
                  backgroundImage:
                      (photoUrl?.isNotEmpty ?? false)
                          ? NetworkImage(photoUrl!)
                          : null,
                  child: (photoUrl?.isEmpty ?? true)
                      ? Text(
                          initial ?? '?',
                          style: const TextStyle(fontSize: 10),
                        )
                      : null,
                ),
                const SizedBox(width: 6),
              ],
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight:
                      selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected
                      ? AppColors.primary
                      : AppColors.textSecondary,
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
      padding: const EdgeInsets.only(left: 4, top: 8, bottom: 8),
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
    required this.done,
    required this.onToggle,
    required this.onTap,
    required this.onDelete,
  });

  final HouseTask task;
  final bool done;
  final VoidCallback onToggle;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final category = taskCategoryFor(task.category);

    return Dismissible(
      key: ValueKey(task.id),
      direction: DismissDirection.endToStart,
      confirmDismiss: (_) async {
        onDelete();
        return false;
      },
      background: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: Colors.red[400],
          borderRadius: BorderRadius.circular(16),
        ),
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        child: const Icon(Icons.delete_outline, color: Colors.white, size: 22),
      ),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: done
              ? AppColors.success.withValues(alpha: 0.06)
              : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: done
                ? AppColors.success.withValues(alpha: 0.3)
                : AppColors.border,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 6,
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
              padding: const EdgeInsets.fromLTRB(12, 12, 8, 12),
              child: Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: category.color.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    alignment: Alignment.center,
                    child: Icon(
                      category.icon,
                      size: 28,
                      color: category.color,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                task.title,
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: done
                                      ? AppColors.textSecondary
                                      : AppColors.textPrimary,
                                  decoration: done
                                      ? TextDecoration.lineThrough
                                      : null,
                                ),
                              ),
                            ),
                            if (task.isHighPriority)
                              Container(
                                margin: const EdgeInsets.only(left: 6),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: AppColors.warning
                                      .withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: const Text(
                                  '!',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.warning,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          [
                            if (task.time.isNotEmpty) task.time,
                            task.assigneeName.split(' ').first,
                          ].join(' · '),
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary
                                .withValues(alpha: 0.8),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 4),
                  Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: onToggle,
                      customBorder: const CircleBorder(),
                      child: Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: done
                              ? AppColors.success
                              : AppColors.primarySoft,
                          border: Border.all(
                            color: done
                                ? AppColors.success
                                : AppColors.primary
                                    .withValues(alpha: 0.3),
                            width: 2,
                          ),
                        ),
                        child: Icon(
                          done ? Icons.check : Icons.circle_outlined,
                          size: 28,
                          color: done ? Colors.white : AppColors.primary,
                        ),
                      ),
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

class _EmptyTasksHint extends StatelessWidget {
  const _EmptyTasksHint();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(16),
      ),
      child: const Row(
        children: [
          Icon(
            Icons.task_alt_outlined,
            color: AppColors.textSecondary,
            size: 28,
          ),
          SizedBox(width: 14),
          Expanded(
            child: Text(
              'Nenhuma tarefa para hoje. Toque em + para criar a primeira.',
              style: TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
