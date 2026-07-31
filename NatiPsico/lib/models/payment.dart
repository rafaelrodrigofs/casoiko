import 'package:cloud_firestore/cloud_firestore.dart';

enum PaymentStatus { received, pending }

class Payment {
  const Payment({
    required this.id,
    required this.patientId,
    required this.patientName,
    required this.amount,
    required this.date,
    this.status = PaymentStatus.pending,
    this.description = '',
  });

  final String id;
  final String patientId;
  final String patientName;
  final double amount;
  final DateTime date;
  final PaymentStatus status;
  final String description;

  factory Payment.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? {};
    return Payment(
      id: doc.id,
      patientId: (d['patientId'] as String?) ?? '',
      patientName: (d['patientName'] as String?) ?? '',
      amount: ((d['amount'] as num?) ?? 0).toDouble(),
      date: (d['date'] as Timestamp?)?.toDate() ?? DateTime.now(),
      status: (d['status'] as String?) == 'received'
          ? PaymentStatus.received
          : PaymentStatus.pending,
      description: (d['description'] as String?) ?? '',
    );
  }

  Map<String, dynamic> toMap() => {
        'patientId': patientId,
        'patientName': patientName,
        'amount': amount,
        'date': Timestamp.fromDate(date),
        'status': status == PaymentStatus.received ? 'received' : 'pending',
        'description': description,
        'createdAt': FieldValue.serverTimestamp(),
      };
}
