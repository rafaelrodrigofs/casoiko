import 'package:cloud_firestore/cloud_firestore.dart';

/// Subtarefa dentro de uma tarefa da casa.
class TaskSubtask {
  const TaskSubtask({
    required this.id,
    required this.title,
    required this.done,
  });

  final String id;
  final String title;
  final bool done;

  factory TaskSubtask.fromMap(Map<String, dynamic> data) {
    return TaskSubtask(
      id: data['id'] as String? ?? '',
      title: data['title'] as String? ?? '',
      done: data['done'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toMap() => {
        'id': id,
        'title': title,
        'done': done,
      };

  TaskSubtask copyWith({String? title, bool? done}) {
    return TaskSubtask(
      id: id,
      title: title ?? this.title,
      done: done ?? this.done,
    );
  }
}

/// Tarefa da casa — rotina, limpeza, compromissos etc.
class HouseTask {
  const HouseTask({
    required this.id,
    required this.houseId,
    required this.title,
    required this.description,
    required this.categoryId,
    required this.assigneeUid,
    required this.assigneeName,
    required this.time,
    required this.priority,
    required this.repeat,
    required this.weekdays,
    required this.subtasks,
    required this.createdAt,
  });

  static const repeatNone = 'none';
  static const repeatDaily = 'daily';
  static const repeatWeekly = 'weekly';

  final String id;
  final String houseId;
  final String title;
  final String description;
  final String categoryId;
  final String assigneeUid;
  final String assigneeName;

  /// Horário opcional no formato "HH:mm".
  final String time;
  final int priority;
  final String repeat;
  final List<int> weekdays;
  final List<TaskSubtask> subtasks;
  final DateTime createdAt;

  bool get isHighPriority => priority > 0;

  int get subtasksDone => subtasks.where((s) => s.done).length;

  bool get allSubtasksDone =>
      subtasks.isEmpty || subtasks.every((s) => s.done);

  /// Tarefa aparece na lista do dia [date].
  bool isVisibleOn(DateTime date) {
    switch (repeat) {
      case repeatDaily:
        return true;
      case repeatWeekly:
        return weekdays.contains(date.weekday);
      case repeatNone:
      default:
        return true;
    }
  }

  /// Período do dia para agrupamento na UI.
  String get periodLabel {
    if (time.isEmpty) return 'Sem horário';
    final parts = time.split(':');
    if (parts.length < 2) return 'Sem horário';
    final hour = int.tryParse(parts[0]) ?? 0;
    if (hour < 12) return 'Manhã';
    if (hour < 18) return 'Tarde';
    return 'Noite';
  }

  static String dateKeyFor(DateTime date) =>
      '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

  factory HouseTask.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    final rawSubtasks = data['subtasks'] as List<dynamic>? ?? [];
    return HouseTask(
      id: doc.id,
      houseId: data['house_id'] as String? ?? '',
      title: data['title'] as String? ?? '',
      description: data['description'] as String? ?? '',
      categoryId: data['category_id'] as String? ?? 'routine',
      assigneeUid: data['assignee_uid'] as String? ?? '',
      assigneeName: data['assignee_name'] as String? ?? '',
      time: data['time'] as String? ?? '',
      priority: data['priority'] as int? ?? 0,
      repeat: data['repeat'] as String? ?? repeatNone,
      weekdays: (data['weekdays'] as List<dynamic>? ?? [])
          .map((e) => (e as num).toInt())
          .toList(),
      subtasks: rawSubtasks
          .map((e) => TaskSubtask.fromMap(Map<String, dynamic>.from(e as Map)))
          .toList(),
      createdAt:
          (data['created_at'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() => {
        'house_id': houseId,
        'title': title,
        'description': description,
        'category_id': categoryId,
        'assignee_uid': assigneeUid,
        'assignee_name': assigneeName,
        'time': time,
        'priority': priority,
        'repeat': repeat,
        'weekdays': weekdays,
        'subtasks': subtasks.map((s) => s.toMap()).toList(),
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
    required this.doneByName,
    required this.proofPhotoBase64,
    required this.proofVideoBase64,
    required this.doneAt,
  });

  final String id;
  final String houseId;
  final String taskId;
  final String dateKey;
  final String doneBy;
  final String doneByName;
  final String proofPhotoBase64;
  final String proofVideoBase64;
  final DateTime doneAt;

  bool get hasProof =>
      proofPhotoBase64.isNotEmpty || proofVideoBase64.isNotEmpty;

  factory TaskCheck.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return TaskCheck(
      id: doc.id,
      houseId: data['house_id'] as String? ?? '',
      taskId: data['task_id'] as String? ?? '',
      dateKey: data['date_key'] as String? ?? '',
      doneBy: data['done_by'] as String? ?? '',
      doneByName: data['done_by_name'] as String? ?? '',
      proofPhotoBase64: data['proof_photo_base64'] as String? ?? '',
      proofVideoBase64: data['proof_video_base64'] as String? ?? '',
      doneAt: (data['done_at'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() => {
        'house_id': houseId,
        'task_id': taskId,
        'date_key': dateKey,
        'done_by': doneBy,
        'done_by_name': doneByName,
        'proof_photo_base64': proofPhotoBase64,
        'proof_video_base64': proofVideoBase64,
        'done_at': Timestamp.fromDate(doneAt),
      };
}
