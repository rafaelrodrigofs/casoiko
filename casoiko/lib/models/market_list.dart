import 'package:cloud_firestore/cloud_firestore.dart';

import '../utils/app_icons.dart';

class MarketList {
  const MarketList({
    required this.id,
    required this.houseId,
    required this.name,
    required this.iconCode,
    required this.createdAt,
  });

  final String id;
  final String houseId;
  final String name;
  final int iconCode;
  final DateTime createdAt;

  factory MarketList.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return MarketList(
      id: doc.id,
      houseId: data['house_id'] as String? ?? '',
      name: data['name'] as String? ?? '',
      iconCode: AppIcons.resolveIconCode(
        iconCode: data['icon_code'] as int?,
        legacyEmoji: data['emoji'] as String?,
        fallback: AppIcons.defaultList,
      ),
      createdAt:
          (data['created_at'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() => {
        'house_id': houseId,
        'name': name,
        'icon_code': iconCode,
        'created_at': Timestamp.fromDate(createdAt),
      };
}
