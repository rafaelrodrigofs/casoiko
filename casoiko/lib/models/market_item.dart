import 'package:cloud_firestore/cloud_firestore.dart';

class MarketItem {
  const MarketItem({
    required this.id,
    required this.houseId,
    required this.listId,
    required this.productId,
    required this.name,
    required this.categoryId,
    required this.quantity,
    required this.unit,
    required this.price,
    required this.notes,
    required this.bought,
    required this.addedBy,
    required this.addedByName,
    required this.createdAt,
  });

  final String id;
  final String houseId;
  final String listId;

  /// Vazio quando o item foi digitado livre, sem vínculo com o catálogo.
  final String productId;
  final String name;
  final String categoryId;
  final double quantity;
  final String unit;

  /// Preço unitário. 0 = ainda sem preço.
  final double price;
  final String notes;
  final bool bought;
  final String addedBy;
  final String addedByName;
  final DateTime createdAt;

  factory MarketItem.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return MarketItem(
      id: doc.id,
      houseId: data['house_id'] as String? ?? '',
      listId: data['list_id'] as String? ?? '',
      productId: data['product_id'] as String? ?? '',
      name: data['name'] as String? ?? '',
      categoryId: data['category_id'] as String? ?? '',
      quantity: (data['quantity'] as num?)?.toDouble() ?? 1,
      unit: data['unit'] as String? ?? 'un',
      price: (data['price'] as num?)?.toDouble() ?? 0,
      notes: data['notes'] as String? ?? '',
      bought: data['bought'] as bool? ?? false,
      addedBy: data['added_by'] as String? ?? '',
      addedByName: data['added_by_name'] as String? ?? '',
      createdAt:
          (data['created_at'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() => {
        'house_id': houseId,
        'list_id': listId,
        'product_id': productId,
        'name': name,
        'category_id': categoryId,
        'quantity': quantity,
        'unit': unit,
        'price': price,
        'notes': notes,
        'bought': bought,
        'added_by': addedBy,
        'added_by_name': addedByName,
        'created_at': Timestamp.fromDate(createdAt),
      };

  /// Preço unitário × quantidade.
  double get subtotal => price * quantity;

  /// "2 kg", "1 un", "500 g" — sem casas decimais desnecessárias.
  String get quantityLabel {
    final q = quantity == quantity.roundToDouble()
        ? quantity.toInt().toString()
        : quantity.toString();
    return '$q $unit';
  }
}
