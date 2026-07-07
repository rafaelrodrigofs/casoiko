import 'package:cloud_firestore/cloud_firestore.dart';

/// Tarefa da casa — rotina, limpeza, compromissos etc.
class HouseTask {
  const HouseTask({
    required this.id,
    required this.houseId,
    required this.title,
    required this.description,
    required this.category,
    required this.assigneeUid,
    required this.assigneeName,
    required this.time,
    required this.priority,
    required this.repeat,
    required this.weekdays,
    required this.createdAt,
  });

  static const repeatNone = 'none';
  static const repeatDaily = 'daily';
  static const repeatWeekly = 'weekly';

  final String id;
  final String houseId;
  final String title;
  final String description;
  final String category;
  final String assigneeUid;
  final String assigneeName;

  /// Horário opcional no formato "HH:mm".
  final String time;

  /// 0 = normal, 1 = alta.
  final int priority;
  final String repeat;

  /// Dias da semana (1=segunda … 7=domingo) para [repeatWeekly].
  final List<int> weekdays;
  final DateTime createdAt;

  bool get isHighPriority => priority >= 1;

  static String dateKeyFor(DateTime date) =>
      '${date.year}-${date.month.toString().padLeft(2, '0')}-'
      '${date.day.toString().padLeft(2, '0')}';

  /// Período do dia para agrupamento na UI.
  static String periodForTime(String time) {
    if (time.isEmpty) return 'Sem horário';
    final parts = time.split(':');
    if (parts.length < 2) return 'Sem horário';
    final hour = int.tryParse(parts[0]) ?? 0;
    if (hour < 12) return 'Manhã';
    if (hour < 18) return 'Tarde';
    return 'Noite';
  }

  /// Se a tarefa deve aparecer na lista do dia [date].
  /// [checkedTodayIds] = concluídas hoje; [everCompletedIds] = já concluídas
  /// alguma vez (para tarefas únicas).
  bool isDueOn(
    DateTime date, {
    required Set<String> everCompletedIds,
  }) {
    switch (repeat) {
      case repeatDaily:
        return true;
      case repeatWeekly:
        return weekdays.contains(date.weekday);
      case repeatNone:
      default:
        return !everCompletedIds.contains(id);
    }
  }

  factory HouseTask.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    final rawWeekdays = data['weekdays'] as List<dynamic>? ?? [];
    return HouseTask(
      id: doc.id,
      houseId: data['house_id'] as String? ?? '',
      title: data['title'] as String? ?? '',
      description: data['description'] as String? ?? '',
      category: data['category'] as String? ?? 'rotina',
      assigneeUid: data['assignee_uid'] as String? ?? '',
      assigneeName: data['assignee_name'] as String? ?? '',
      time: data['time'] as String? ?? '',
      priority: data['priority'] as int? ?? 0,
      repeat: data['repeat'] as String? ?? repeatNone,
      weekdays: rawWeekdays.map((e) => (e as num).toInt()).toList(),
      createdAt:
          (data['created_at'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() => {
        'house_id': houseId,
        'title': title,
        'description': description,
        'category': category,
        'assignee_uid': assigneeUid,
        'assignee_name': assigneeName,
        'time': time,
        'priority': priority,
        'repeat': repeat,
        'weekdays': weekdays,
        'created_at': Timestamp.fromDate(createdAt),
      };
}

/// Registro de conclusão de uma tarefa em um dia específico.
class TaskCheck {
  const TaskCheck({
    required this.id,
    required this.houseId,
    required this.taskId,
    required this.dateKey,
    required this.doneBy,
    required this.doneAt,
  });

  final String id;
  final String houseId;
  final String taskId;
  final String dateKey;
  final String doneBy;
  final DateTime doneAt;

  factory TaskCheck.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return TaskCheck(
      id: doc.id,
      houseId: data['house_id'] as String? ?? '',
      taskId: data['task_id'] as String? ?? '',
      dateKey: data['date_key'] as String? ?? '',
      doneBy: data['done_by'] as String? ?? '',
      doneAt: (data['done_at'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() => {
        'house_id': houseId,
        'task_id': taskId,
        'date_key': dateKey,
        'done_by': doneBy,
        'done_at': Timestamp.fromDate(doneAt),
      };
}
