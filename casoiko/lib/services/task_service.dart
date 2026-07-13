import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/house_task.dart';
import '../models/task_repeat_config.dart';
import '../utils/task_dates.dart';

class TaskService {
  TaskService({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference get _tasks => _firestore.collection('tasks');
  CollectionReference get _checks => _firestore.collection('task_checks');

  Stream<List<HouseTask>> tasksStream(String houseId) {
    return _tasks.where('house_id', isEqualTo: houseId).snapshots().map((snap) {
      final tasks = snap.docs.map(HouseTask.fromFirestore).toList();
      tasks.sort((a, b) {
        final timeCmp = a.time.compareTo(b.time);
        if (timeCmp != 0) return timeCmp;
        return a.title.compareTo(b.title);
      });
      return tasks;
    });
  }

  Stream<HouseTask?> taskStream(String taskId) {
    return _tasks.doc(taskId).snapshots().map((doc) {
      if (!doc.exists) return null;
      return HouseTask.fromFirestore(doc);
    });
  }

  Stream<List<TaskCheck>> checksStream(String houseId, String dateKey) {
    return _checks
        .where('house_id', isEqualTo: houseId)
        .where('date_key', isEqualTo: dateKey)
        .snapshots()
        .map((snap) => snap.docs.map(TaskCheck.fromFirestore).toList());
  }

  /// Conclusoes em um intervalo de datas (inclusive), para faixa semanal e backlog.
  ///
  /// Filtra no cliente para evitar indice composto house_id + date_key no Firestore.
  Stream<List<TaskCheck>> checksStreamForRange(
    String houseId,
    String startKey,
    String endKey,
  ) {
    return _checks.where('house_id', isEqualTo: houseId).snapshots().map((snap) {
      return snap.docs
          .map(TaskCheck.fromFirestore)
          .where(
            (c) =>
                c.dateKey.compareTo(startKey) >= 0 &&
                c.dateKey.compareTo(endKey) <= 0,
          )
          .toList();
    });
  }

  /// Segunda a domingo da semana que contem [anchor].
  static ({String startKey, String endKey, DateTime weekStart}) weekRangeKeys(
    DateTime anchor,
  ) {
    final date = DateTime(anchor.year, anchor.month, anchor.day);
    final weekStart = date.subtract(Duration(days: date.weekday - 1));
    final weekEnd = weekStart.add(const Duration(days: 6));
    return (
      startKey: HouseTask.dateKeyFor(weekStart),
      endKey: HouseTask.dateKeyFor(weekEnd),
      weekStart: weekStart,
    );
  }

  /// Ultimos [days] dias antes de hoje (exclui hoje), para alerta de atraso.
  static ({String startKey, String endKey}) backlogRangeKeys({int days = 7}) {
    final today = DateTime.now();
    final end = DateTime(today.year, today.month, today.day)
        .subtract(const Duration(days: 1));
    final start = end.subtract(Duration(days: days - 1));
    return (
      startKey: HouseTask.dateKeyFor(start),
      endKey: HouseTask.dateKeyFor(end),
    );
  }

  /// Intervalo do grid mensal (42 dias visiveis na grade).
  static ({String startKey, String endKey}) monthRangeKeys(DateTime anchor) {
    final days = TaskDates.daysForMonthGrid(anchor);
    return (
      startKey: HouseTask.dateKeyFor(days.first),
      endKey: HouseTask.dateKeyFor(days.last),
    );
  }

  Future<void> addTask({
    required String houseId,
    required String title,
    required String description,
    required String categoryId,
    required String assigneeUid,
    required String assigneeName,
    required String time,
    required int priority,
    required TaskRepeatConfig repeatConfig,
    required List<TaskSubtask> subtasks,
  }) {
    return _tasks.add({
      'house_id': houseId,
      'title': title,
      'description': description,
      'category_id': categoryId,
      'assignee_uid': assigneeUid,
      'assignee_name': assigneeName,
      'time': time,
      'priority': priority,
      ...repeatConfig.toFirestoreMap(),
      'subtasks': subtasks.map((s) => s.toMap()).toList(),
      'created_at': FieldValue.serverTimestamp(),
    });
  }

  Future<void> updateTask({
    required String taskId,
    required String title,
    required String description,
    required String categoryId,
    required String assigneeUid,
    required String assigneeName,
    required String time,
    required int priority,
    required TaskRepeatConfig repeatConfig,
    required List<TaskSubtask> subtasks,
  }) {
    return _tasks.doc(taskId).update({
      'title': title,
      'description': description,
      'category_id': categoryId,
      'assignee_uid': assigneeUid,
      'assignee_name': assigneeName,
      'time': time,
      'priority': priority,
      ...repeatConfig.toFirestoreMap(),
      'subtasks': subtasks.map((s) => s.toMap()).toList(),
    });
  }

  Future<void> deleteTask(String taskId) {
    return _tasks.doc(taskId).delete();
  }

  Future<void> updateSubtaskDone({
    required String taskId,
    required String subtaskId,
    required bool done,
  }) async {
    final doc = await _tasks.doc(taskId).get();
    if (!doc.exists) return;
    final task = HouseTask.fromFirestore(doc);
    final updated = task.subtasks
        .map((s) => s.id == subtaskId ? s.copyWith(done: done) : s)
        .map((s) => s.toMap())
        .toList();
    await _tasks.doc(taskId).update({'subtasks': updated});
  }

  Future<void> completeTask({
    required String houseId,
    required String taskId,
    required String dateKey,
    required String doneBy,
    required String doneByName,
    String proofPhotoBase64 = '',
    String proofVideoBase64 = '',
  }) {
    return _checks.add({
      'house_id': houseId,
      'task_id': taskId,
      'date_key': dateKey,
      'done_by': doneBy,
      'done_by_name': doneByName,
      'proof_photo_base64': proofPhotoBase64,
      'proof_video_base64': proofVideoBase64,
      'done_at': FieldValue.serverTimestamp(),
    });
  }

  Future<void> undoComplete(String checkId) {
    return _checks.doc(checkId).delete();
  }
}
