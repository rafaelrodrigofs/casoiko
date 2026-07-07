import 'package:cloud_firestore/cloud_firestore.dart';

/// Lançamento financeiro do mês: receita (salário) ou despesa
/// (conta fixa paga, gasto avulso, mercado...).
class FinanceTransaction {
  const FinanceTransaction({
    required this.id,
    required this.houseId,
    required this.type,
    required this.description,
    required this.amount,
    required this.date,
    required this.monthKey,
    required this.category,
    required this.paidBy,
    required this.paidByName,
    required this.billId,
    required this.splitAll,
    required this.createdAt,
  });

  static const typeIncome = 'income';
  static const typeExpense = 'expense';

  final String id;
  final String houseId;

  /// [typeIncome] ou [typeExpense].
  final String type;
  final String description;
  final double amount;
  final DateTime date;

  /// "2026-07" — usado para filtrar o mês direto no Firestore.
  final String monthKey;
  final String category;
  final String paidBy;
  final String paidByName;

  /// Preenchido quando o lançamento é o pagamento de uma conta fixa.
  final String billId;

  /// Despesa dividida entre todos os membros. Quando false, é só de quem
  /// pagou e fica fora da divisão da casa.
  final bool splitAll;
  final DateTime createdAt;

  bool get isIncome => type == typeIncome;

  static String monthKeyFor(DateTime date) =>
      '${date.year}-${date.month.toString().padLeft(2, '0')}';

  factory FinanceTransaction.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return FinanceTransaction(
      id: doc.id,
      houseId: data['house_id'] as String? ?? '',
      type: data['type'] as String? ?? typeExpense,
      description: data['description'] as String? ?? '',
      amount: (data['amount'] as num?)?.toDouble() ?? 0,
      date: (data['date'] as Timestamp?)?.toDate() ?? DateTime.now(),
      monthKey: data['month_key'] as String? ?? '',
      category: data['category'] as String? ?? 'Outros',
      paidBy: data['paid_by'] as String? ?? '',
      paidByName: data['paid_by_name'] as String? ?? '',
      billId: data['bill_id'] as String? ?? '',
      splitAll: data['split_all'] as bool? ?? true,
      createdAt:
          (data['created_at'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() => {
        'house_id': houseId,
        'type': type,
        'description': description,
        'amount': amount,
        'date': Timestamp.fromDate(date),
        'month_key': monthKey,
        'category': category,
        'paid_by': paidBy,
        'paid_by_name': paidByName,
        'bill_id': billId,
        'split_all': splitAll,
        'created_at': Timestamp.fromDate(createdAt),
      };
}

/// Membro da casa, lido da coleção `users`.
class HouseMember {
  const HouseMember({
    required this.uid,
    required this.name,
    required this.photoUrl,
  });

  final String uid;
  final String name;
  final String photoUrl;

  factory HouseMember.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return HouseMember(
      uid: doc.id,
      name: data['name'] as String? ?? 'Morador',
      photoUrl: data['photo_url'] as String? ?? '',
    );
  }

  /// Primeiro nome, para caber nos cards.
  String get firstName => name.split(' ').first;
}
