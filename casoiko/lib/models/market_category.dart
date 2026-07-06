import 'package:cloud_firestore/cloud_firestore.dart';

class MarketCategory {
  const MarketCategory({
    required this.id,
    required this.houseId,
    required this.name,
    required this.emoji,
    required this.sortOrder,
  });

  final String id;
  final String houseId;
  final String name;
  final String emoji;
  final int sortOrder;

  factory MarketCategory.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return MarketCategory(
      id: doc.id,
      houseId: data['house_id'] as String? ?? '',
      name: data['name'] as String? ?? '',
      emoji: data['emoji'] as String? ?? '📦',
      sortOrder: data['sort_order'] as int? ?? 999,
    );
  }

  Map<String, dynamic> toMap() => {
        'house_id': houseId,
        'name': name,
        'emoji': emoji,
        'sort_order': sortOrder,
      };
}
