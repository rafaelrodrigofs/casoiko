import 'package:cloud_firestore/cloud_firestore.dart';

class MarketList {
  const MarketList({
    required this.id,
    required this.houseId,
    required this.name,
    required this.emoji,
    required this.createdAt,
  });

  final String id;
  final String houseId;
  final String name;
  final String emoji;
  final DateTime createdAt;

  factory MarketList.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return MarketList(
      id: doc.id,
      houseId: data['house_id'] as String? ?? '',
      name: data['name'] as String? ?? '',
      emoji: data['emoji'] as String? ?? '🛒',
      createdAt:
          (data['created_at'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() => {
        'house_id': houseId,
        'name': name,
        'emoji': emoji,
        'created_at': Timestamp.fromDate(createdAt),
      };
}
