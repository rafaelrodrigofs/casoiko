import 'package:cloud_firestore/cloud_firestore.dart';

/// Conta fixa da casa (luz, internet, aluguel...). É um modelo recorrente:
/// todo mês ela aparece como pendente até alguém registrar o pagamento.
class Bill {
  const Bill({
    required this.id,
    required this.houseId,
    required this.name,
    required this.amount,
    required this.dueDay,
    required this.category,
    required this.createdAt,
  });

  final String id;
  final String houseId;
  final String name;

  /// Valor previsto. O valor real é informado ao pagar (luz varia, etc).
  final double amount;

  /// Dia do mês em que vence (1–31).
  final int dueDay;
  final String category;
  final DateTime createdAt;

  factory Bill.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Bill(
      id: doc.id,
      houseId: data['house_id'] as String? ?? '',
      name: data['name'] as String? ?? '',
      amount: (data['amount'] as num?)?.toDouble() ?? 0,
      dueDay: data['due_day'] as int? ?? 1,
      category: data['category'] as String? ?? 'Outros',
      createdAt:
          (data['created_at'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() => {
        'house_id': houseId,
        'name': name,
        'amount': amount,
        'due_day': dueDay,
        'category': category,
        'created_at': Timestamp.fromDate(createdAt),
      };
}
