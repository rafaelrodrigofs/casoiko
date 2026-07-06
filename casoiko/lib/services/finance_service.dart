import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/bill.dart';
import '../models/finance_transaction.dart';

/// Categorias de despesa da casa.
const kExpenseCategories = [
  '🏠 Moradia',
  '⚡ Utilidades',
  '🛒 Alimentação',
  '🚗 Transporte',
  '💊 Saúde',
  '📺 Assinaturas',
  '🔧 Manutenção',
  '🎉 Lazer',
  '📦 Outros',
];

/// Categorias de receita.
const kIncomeCategories = [
  '💰 Salário',
  '💵 Extra',
  '📦 Outros',
];

class FinanceService {
  FinanceService({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference get _bills => _firestore.collection('bills');
  CollectionReference get _transactions =>
      _firestore.collection('transactions');

  // ---------------------------------------------------------------------
  // Membros da casa
  // ---------------------------------------------------------------------

  Stream<List<HouseMember>> membersStream(String houseId) {
    return _firestore
        .collection('users')
        .where('house_id', isEqualTo: houseId)
        .snapshots()
        .map((snap) => snap.docs.map(HouseMember.fromFirestore).toList());
  }

  // ---------------------------------------------------------------------
  // Contas fixas
  // ---------------------------------------------------------------------

  Stream<List<Bill>> billsStream(String houseId) {
    return _bills.where('house_id', isEqualTo: houseId).snapshots().map(
      (snap) {
        final bills = snap.docs.map(Bill.fromFirestore).toList();
        bills.sort((a, b) => a.dueDay.compareTo(b.dueDay));
        return bills;
      },
    );
  }

  Future<void> addBill({
    required String houseId,
    required String name,
    required double amount,
    required int dueDay,
    required String category,
  }) {
    return _bills.add({
      'house_id': houseId,
      'name': name,
      'amount': amount,
      'due_day': dueDay,
      'category': category,
      'created_at': FieldValue.serverTimestamp(),
    });
  }

  Future<void> updateBill({
    required String billId,
    required String name,
    required double amount,
    required int dueDay,
    required String category,
  }) {
    return _bills.doc(billId).update({
      'name': name,
      'amount': amount,
      'due_day': dueDay,
      'category': category,
    });
  }

  Future<void> deleteBill(String billId) {
    return _bills.doc(billId).delete();
  }

  // ---------------------------------------------------------------------
  // Lançamentos
  // ---------------------------------------------------------------------

  Stream<List<FinanceTransaction>> transactionsStream(
    String houseId,
    String monthKey,
  ) {
    return _transactions
        .where('house_id', isEqualTo: houseId)
        .where('month_key', isEqualTo: monthKey)
        .snapshots()
        .map((snap) {
      final transactions =
          snap.docs.map(FinanceTransaction.fromFirestore).toList();
      transactions.sort((a, b) => b.date.compareTo(a.date));
      return transactions;
    });
  }

  Future<void> addTransaction({
    required String houseId,
    required String type,
    required String description,
    required double amount,
    required DateTime date,
    required String category,
    required String paidBy,
    required String paidByName,
    String billId = '',
  }) {
    return _transactions.add({
      'house_id': houseId,
      'type': type,
      'description': description,
      'amount': amount,
      'date': Timestamp.fromDate(date),
      'month_key': FinanceTransaction.monthKeyFor(date),
      'category': category,
      'paid_by': paidBy,
      'paid_by_name': paidByName,
      'bill_id': billId,
      'created_at': FieldValue.serverTimestamp(),
    });
  }

  Future<void> deleteTransaction(String transactionId) {
    return _transactions.doc(transactionId).delete();
  }
}
