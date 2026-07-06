import 'package:cloud_firestore/cloud_firestore.dart';

import '../utils/app_icons.dart';

class MarketCategory {
  const MarketCategory({
    required this.id,
    required this.houseId,
    required this.name,
    required this.iconCode,
    required this.sortOrder,
  });

  final String id;
  final String houseId;
  final String name;
  final int iconCode;
  final int sortOrder;

  factory MarketCategory.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    final name = data['name'] as String? ?? '';
    return MarketCategory(
      id: doc.id,
      houseId: data['house_id'] as String? ?? '',
      name: name,
      iconCode: AppIcons.resolveIconCode(
        iconCode: data['icon_code'] as int?,
        legacyEmoji: data['emoji'] as String?,
        name: name,
      ),
      sortOrder: data['sort_order'] as int? ?? 999,
    );
  }

  Map<String, dynamic> toMap() => {
        'house_id': houseId,
        'name': name,
        'icon_code': iconCode,
        'sort_order': sortOrder,
      };
}
