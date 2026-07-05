import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/market_item.dart';

class MarketService {
  MarketService({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  /// Stream em tempo real dos itens da casa, ordenado por data de criação.
  /// Ordenação feita no cliente para evitar índice composto no Firestore.
  Stream<List<MarketItem>> itemsStream(String houseId) {
    return _firestore
        .collection('market_items')
        .where('house_id', isEqualTo: houseId)
        .snapshots()
        .map((snap) {
      final items = snap.docs.map(MarketItem.fromFirestore).toList();
      items.sort((a, b) => a.createdAt.compareTo(b.createdAt));
      return items;
    });
  }

  Future<void> addItem({
    required String houseId,
    required String name,
    required String addedBy,
    required String addedByName,
  }) {
    return _firestore.collection('market_items').add({
      'house_id': houseId,
      'name': name,
      'bought': false,
      'added_by': addedBy,
      'added_by_name': addedByName,
      'created_at': FieldValue.serverTimestamp(),
    });
  }

  Future<void> toggleBought(String itemId, {required bool newValue}) {
    return _firestore
        .collection('market_items')
        .doc(itemId)
        .update({'bought': newValue});
  }

  Future<void> deleteItem(String itemId) {
    return _firestore.collection('market_items').doc(itemId).delete();
  }
}
