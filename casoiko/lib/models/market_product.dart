import 'package:cloud_firestore/cloud_firestore.dart';

class MarketProduct {
  const MarketProduct({
    required this.id,
    required this.houseId,
    required this.name,
    required this.categoryId,
    required this.unit,
    required this.isFixed,
    required this.lastPrice,
    this.photoBase64 = '',
    required this.createdAt,
  });

  final String id;
  final String houseId;
  final String name;
  final String categoryId;

  /// Unidade padrão de compra (un, kg, L, pct...).
  final String unit;

  /// Produto fixo = comprado sempre (arroz, café). Variável = eventual.
  final bool isFixed;

  /// Último preço pago. 0 = nunca registrado.
  final double lastPrice;

  /// Miniatura JPEG em base64, salva direto no Firestore. Vazio = sem foto.
  final String photoBase64;
  final DateTime createdAt;

  factory MarketProduct.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return MarketProduct(
      id: doc.id,
      houseId: data['house_id'] as String? ?? '',
      name: data['name'] as String? ?? '',
      categoryId: data['category_id'] as String? ?? '',
      unit: data['unit'] as String? ?? 'un',
      isFixed: data['is_fixed'] as bool? ?? false,
      lastPrice: (data['last_price'] as num?)?.toDouble() ?? 0,
      photoBase64: data['photo_b64'] as String? ?? '',
      createdAt:
          (data['created_at'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() => {
        'house_id': houseId,
        'name': name,
        'name_lower': name.toLowerCase(),
        'category_id': categoryId,
        'unit': unit,
        'is_fixed': isFixed,
        'last_price': lastPrice,
        'photo_b64': photoBase64,
        'created_at': Timestamp.fromDate(createdAt),
      };
}
