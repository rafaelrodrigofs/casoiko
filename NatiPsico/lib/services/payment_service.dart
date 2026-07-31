import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/payment.dart';
import '../utils/firestore_paths.dart';
import '../utils/format.dart';

class PaymentSummary {
  const PaymentSummary({
    required this.received,
    required this.pending,
    required this.receivedCount,
    required this.pendingCount,
  });

  final double received;
  final double pending;
  final int receivedCount;
  final int pendingCount;

  double get total => received + pending;
}

class PaymentService {
  PaymentService(this.uid);

  final String uid;

  CollectionReference<Map<String, dynamic>> get _col =>
      FirestorePaths.payments(uid);

  Stream<List<Payment>> watchMonth(DateTime month) {
    final start = startOfMonth(month);
    final end = endOfMonth(month);
    return _col
        .where('date', isGreaterThanOrEqualTo: Timestamp.fromDate(start))
        .where('date', isLessThanOrEqualTo: Timestamp.fromDate(end))
        .orderBy('date', descending: true)
        .snapshots()
        .map((snap) => snap.docs.map(Payment.fromDoc).toList());
  }

  Future<PaymentSummary> summaryForMonth(DateTime month) async {
    final start = startOfMonth(month);
    final end = endOfMonth(month);
    final snap = await _col
        .where('date', isGreaterThanOrEqualTo: Timestamp.fromDate(start))
        .where('date', isLessThanOrEqualTo: Timestamp.fromDate(end))
        .get();

    var received = 0.0;
    var pending = 0.0;
    var receivedCount = 0;
    var pendingCount = 0;

    for (final doc in snap.docs) {
      final p = Payment.fromDoc(doc);
      if (p.status == PaymentStatus.received) {
        received += p.amount;
        receivedCount++;
      } else {
        pending += p.amount;
        pendingCount++;
      }
    }

    return PaymentSummary(
      received: received,
      pending: pending,
      receivedCount: receivedCount,
      pendingCount: pendingCount,
    );
  }

  Future<String> create(Payment payment) async {
    final ref = await _col.add(payment.toMap());
    return ref.id;
  }

  Future<void> markReceived(String id) async {
    await _col.doc(id).update({'status': 'received'});
  }

  Future<void> delete(String id) async {
    await _col.doc(id).delete();
  }
}
