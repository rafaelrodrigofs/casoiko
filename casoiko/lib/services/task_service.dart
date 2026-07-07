import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/finance_transaction.dart';
import '../models/house_task.dart';

export '../models/finance_transaction.dart' show HouseMember;

class TaskService {
  TaskService({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference get _tasks => _firestore.collection('tasks');
  CollectionReference get _checks => _firestore.collection('task_checks');

  Stream<List<HouseMember>> membersStream(String houseId) {
    return _firestore
        .collection('users')
        .where('house_id', isEqualTo: houseId)
        .snapshots()
        .map((snap) => snap.docs.map(HouseMember.fromFirestore).toList());
  }

  Stream<List<HouseTask>> tasksStream(String houseId) {
    return _tasks.where('house_id', isEqualTo: houseId).snapshots().map(
      (snap) {
        final tasks = snap.docs.map(HouseTask.fromFirestore).toList();
        tasks.sort((a, b) {
          final timeCmp = a.time.compareTo(b.time);
          if (timeCmp != 0) return timeCmp;
          return a.title.compareTo(b.title);
        });
        return tasks;
      },
    );
  }

  Stream<List<TaskCheck>> checksStream(String houseId, String dateKey) {
    return _checks
        .where('house_id', isEqualTo: houseId)
        .where('date_key', isEqualTo: dateKey)
        .snapshots()
        .map((snap) => snap.docs.map(TaskCheck.fromFirestore).toList());
  }

  /// IDs de tarefas que já foram concluídas alguma vez (para repeat none).
  Stream<Set<String>> everCheckedTaskIdsStream(String houseId) {
    return _checks.where('house_id', isEqualTo: houseId).snapshots().map(
      (snap) => snap.docs
          .map((doc) => TaskCheck.fromFirestore(doc).taskId)
          .toSet(),
    );
  }

  Future<void> addTask({
    required String houseId,
    required String title,
    required String description,
    required String category,
    required String assigneeUid,
    required String assigneeName,
    required String time,
    required int priority,
    required String repeat,
    required List<int> weekdays,
  }) {
    return _tasks.add({
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
      'created_at': FieldValue.serverTimestamp(),
    });
  }

  Future<void> updateTask({
    required String taskId,
    required String title,
    required String description,
    required String category,
    required String assigneeUid,
    required String assigneeName,
    required String time,
    required int priority,
    required String repeat,
    required List<int> weekdays,
  }) {
    return _tasks.doc(taskId).update({
      'title': title,
      'description': description,
      'category': category,
      'assignee_uid': assigneeUid,
      'assignee_name': assigneeName,
      'time': time,
      'priority': priority,
      'repeat': repeat,
      'weekdays': weekdays,
    });
  }

  Future<void> deleteTask(String taskId) {
    return _tasks.doc(taskId).delete();
  }

  Future<void> toggleCheck({
    required String houseId,
    required String taskId,
    required String dateKey,
    required String doneBy,
    required bool done,
    String? checkId,
  }) async {
    if (done) {
      await _checks.add({
        'house_id': houseId,
        'task_id': taskId,
        'date_key': dateKey,
        'done_by': doneBy,
        'done_at': FieldValue.serverTimestamp(),
      });
    } else if (checkId != null) {
      await _checks.doc(checkId).delete();
    }
  }
}
