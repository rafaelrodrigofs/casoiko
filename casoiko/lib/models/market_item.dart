import 'package:cloud_firestore/cloud_firestore.dart';

class MarketItem {
  const MarketItem({
    required this.id,
    required this.houseId,
    required this.name,
    required this.bought,
    required this.addedBy,
    required this.addedByName,
    required this.createdAt,
  });

  final String id;
  final String houseId;
  final String name;
  final bool bought;
  final String addedBy;
  final String addedByName;
  final DateTime createdAt;

  factory MarketItem.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return MarketItem(
      id: doc.id,
      houseId: data['house_id'] as String? ?? '',
      name: data['name'] as String? ?? '',
      bought: data['bought'] as bool? ?? false,
      addedBy: data['added_by'] as String? ?? '',
      addedByName: data['added_by_name'] as String? ?? '',
      createdAt:
          (data['created_at'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() => {
        'house_id': houseId,
        'name': name,
        'bought': bought,
        'added_by': addedBy,
        'added_by_name': addedByName,
        'created_at': Timestamp.fromDate(createdAt),
      };

  MarketItem copyWith({bool? bought}) => MarketItem(
        id: id,
        houseId: houseId,
        name: name,
        bought: bought ?? this.bought,
        addedBy: addedBy,
        addedByName: addedByName,
        createdAt: createdAt,
      );
}
