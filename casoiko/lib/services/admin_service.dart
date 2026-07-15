import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/finance_transaction.dart';
import '../models/house_task.dart';
import 'task_service.dart';

/// Helpers do painel Admin (órfãos, contagens, export).
class AdminService {
  AdminService({
    FirebaseFirestore? firestore,
    TaskService? taskService,
  })  : _firestore = firestore ?? FirebaseFirestore.instance,
        _taskService = taskService ?? TaskService();

  final FirebaseFirestore _firestore;
  final TaskService _taskService;

  static bool canManage(List<HouseMember> members, String? uid) {
    if (uid == null || uid.isEmpty) return false;
    final hasAdmin = members.any((m) => m.isAdmin);
    HouseMember? me;
    for (final m in members) {
      if (m.uid == uid) {
        me = m;
        break;
      }
    }
    return (me?.isAdmin ?? false) || !hasAdmin;
  }

  static List<TaskCheck> orphans(
    List<HouseTask> tasks,
    List<TaskCheck> checks,
  ) {
    final taskIds = {for (final t in tasks) t.id};
    return checks.where((c) => !taskIds.contains(c.taskId)).toList();
  }

  static bool isOrphan(TaskCheck check, Set<String> taskIds) =>
      !taskIds.contains(check.taskId);

  Future<void> deleteChecks(List<String> ids) =>
      _taskService.deleteChecksBatch(ids);

  /// Snapshot one-shot das coleções da casa → JSON (sem base64 de prova).
  Future<String> exportHouseJson(String houseId) async {
    Future<List<Map<String, dynamic>>> col(String name) async {
      final snap = await _firestore
          .collection(name)
          .where('house_id', isEqualTo: houseId)
          .get();
      return snap.docs.map((d) {
        final data = Map<String, dynamic>.from(d.data());
        data['id'] = d.id;
        _sanitizeForExport(data);
        return data;
      }).toList();
    }

    final houseSnap =
        await _firestore.collection('houses').doc(houseId).get();
    final houseData = houseSnap.exists
        ? Map<String, dynamic>.from(houseSnap.data()!)
        : <String, dynamic>{};
    houseData['id'] = houseId;
    _sanitizeForExport(houseData);

    final usersSnap = await _firestore
        .collection('users')
        .where('house_id', isEqualTo: houseId)
        .get();
    final users = usersSnap.docs.map((d) {
      final data = Map<String, dynamic>.from(d.data());
      data['id'] = d.id;
      _sanitizeForExport(data);
      return data;
    }).toList();

    final payload = {
      'exported_at': DateTime.now().toIso8601String(),
      'house_id': houseId,
      'house': houseData,
      'users': users,
      'tasks': await col('tasks'),
      'task_checks': await col('task_checks'),
      'market_lists': await col('market_lists'),
      'market_items': await col('market_items'),
      'market_products': await col('market_products'),
      'bills': await col('bills'),
      'transactions': await col('transactions'),
      'messages': await col('messages'),
    };

    return const JsonEncoder.withIndent('  ').convert(payload);
  }

  Future<AdminDbCounts> fetchDbCounts(String houseId) async {
    Future<int> count(String name) async {
      final snap = await _firestore
          .collection(name)
          .where('house_id', isEqualTo: houseId)
          .get();
      return snap.docs.length;
    }

    final tasks = await _firestore
        .collection('tasks')
        .where('house_id', isEqualTo: houseId)
        .get();
    final checks = await _firestore
        .collection('task_checks')
        .where('house_id', isEqualTo: houseId)
        .get();
    final taskIds = {for (final d in tasks.docs) d.id};
    var orphans = 0;
    for (final d in checks.docs) {
      final tid = d.data()['task_id'] as String? ?? '';
      if (!taskIds.contains(tid)) orphans++;
    }

    final members = await _firestore
        .collection('users')
        .where('house_id', isEqualTo: houseId)
        .get();

    return AdminDbCounts(
      tasks: tasks.docs.length,
      taskChecks: checks.docs.length,
      orphanChecks: orphans,
      members: members.docs.length,
      marketLists: await count('market_lists'),
      marketItems: await count('market_items'),
      bills: await count('bills'),
      transactions: await count('transactions'),
      messages: await count('messages'),
    );
  }

  static void _sanitizeForExport(Map<String, dynamic> data) {
    for (final key in List<String>.from(data.keys)) {
      final v = data[key];
      if (v is Timestamp) {
        data[key] = v.toDate().toIso8601String();
      } else if (key.contains('base64') && v is String && v.isNotEmpty) {
        data[key] = '<omitted ${v.length} chars>';
      } else if (v is Map) {
        _sanitizeForExport(Map<String, dynamic>.from(v));
      }
    }
  }
}

class AdminDbCounts {
  const AdminDbCounts({
    required this.tasks,
    required this.taskChecks,
    required this.orphanChecks,
    required this.members,
    required this.marketLists,
    required this.marketItems,
    required this.bills,
    required this.transactions,
    required this.messages,
  });

  final int tasks;
  final int taskChecks;
  final int orphanChecks;
  final int members;
  final int marketLists;
  final int marketItems;
  final int bills;
  final int transactions;
  final int messages;
}
