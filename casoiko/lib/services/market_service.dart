import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/market_category.dart';
import '../models/market_item.dart';
import '../models/market_list.dart';
import '../models/market_product.dart';

/// Unidades de compra disponíveis no app.
const kMarketUnits = ['un', 'kg', 'g', 'L', 'mL', 'pct', 'cx', 'dz'];

class MarketService {
  MarketService({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference get _lists => _firestore.collection('market_lists');
  CollectionReference get _categories =>
      _firestore.collection('market_categories');
  CollectionReference get _products =>
      _firestore.collection('market_products');
  CollectionReference get _items => _firestore.collection('market_items');

  static const _defaultCategories = [
    ('Hortifruti', '🥬'),
    ('Carnes e Frios', '🥩'),
    ('Laticínios', '🧀'),
    ('Padaria', '🍞'),
    ('Mercearia', '🥫'),
    ('Bebidas', '🥤'),
    ('Limpeza', '🧴'),
    ('Higiene', '🧻'),
    ('Outros', '📦'),
  ];

  /// Garante que a casa tem as categorias padrão e ao menos uma lista.
  /// Também migra itens antigos (sem list_id) para a lista padrão.
  Future<void> ensureDefaults(String houseId) async {
    final categoriesSnap =
        await _categories.where('house_id', isEqualTo: houseId).limit(1).get();

    if (categoriesSnap.docs.isEmpty) {
      final batch = _firestore.batch();
      for (var i = 0; i < _defaultCategories.length; i++) {
        final (name, emoji) = _defaultCategories[i];
        batch.set(_categories.doc(), {
          'house_id': houseId,
          'name': name,
          'emoji': emoji,
          'sort_order': i,
        });
      }
      await batch.commit();
    }

    final listsSnap =
        await _lists.where('house_id', isEqualTo: houseId).limit(1).get();

    String defaultListId;
    if (listsSnap.docs.isEmpty) {
      final doc = await _lists.add({
        'house_id': houseId,
        'name': 'Mercado',
        'emoji': '🛒',
        'created_at': FieldValue.serverTimestamp(),
      });
      defaultListId = doc.id;
    } else {
      defaultListId = listsSnap.docs.first.id;
    }

    // Migra itens criados na versão anterior do app (sem list_id).
    final orphanItems =
        await _items.where('house_id', isEqualTo: houseId).get();
    final batch = _firestore.batch();
    var hasOrphans = false;
    for (final doc in orphanItems.docs) {
      final data = doc.data() as Map<String, dynamic>;
      if ((data['list_id'] as String?) == null) {
        batch.update(doc.reference, {'list_id': defaultListId});
        hasOrphans = true;
      }
    }
    if (hasOrphans) await batch.commit();
  }

  // ---------------------------------------------------------------------
  // Listas
  // ---------------------------------------------------------------------

  Stream<List<MarketList>> listsStream(String houseId) {
    return _lists.where('house_id', isEqualTo: houseId).snapshots().map(
      (snap) {
        final lists = snap.docs.map(MarketList.fromFirestore).toList();
        lists.sort((a, b) => a.createdAt.compareTo(b.createdAt));
        return lists;
      },
    );
  }

  Future<void> createList({
    required String houseId,
    required String name,
    required String emoji,
  }) {
    return _lists.add({
      'house_id': houseId,
      'name': name,
      'emoji': emoji,
      'created_at': FieldValue.serverTimestamp(),
    });
  }

  /// Apaga a lista e todos os itens dela.
  Future<void> deleteList(String listId) async {
    final items = await _items.where('list_id', isEqualTo: listId).get();
    final batch = _firestore.batch();
    for (final doc in items.docs) {
      batch.delete(doc.reference);
    }
    batch.delete(_lists.doc(listId));
    await batch.commit();
  }

  // ---------------------------------------------------------------------
  // Categorias
  // ---------------------------------------------------------------------

  Stream<List<MarketCategory>> categoriesStream(String houseId) {
    return _categories.where('house_id', isEqualTo: houseId).snapshots().map(
      (snap) {
        final categories =
            snap.docs.map(MarketCategory.fromFirestore).toList();
        categories.sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
        return categories;
      },
    );
  }

  Future<String> addCategory({
    required String houseId,
    required String name,
    required String emoji,
  }) async {
    final doc = await _categories.add({
      'house_id': houseId,
      'name': name,
      'emoji': emoji,
      'sort_order': 100,
    });
    return doc.id;
  }

  // ---------------------------------------------------------------------
  // Produtos (catálogo)
  // ---------------------------------------------------------------------

  Stream<List<MarketProduct>> productsStream(String houseId) {
    return _products.where('house_id', isEqualTo: houseId).snapshots().map(
      (snap) {
        final products = snap.docs.map(MarketProduct.fromFirestore).toList();
        products.sort(
          (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
        );
        return products;
      },
    );
  }

  Future<String> addProduct({
    required String houseId,
    required String name,
    required String categoryId,
    required String unit,
    required bool isFixed,
    double lastPrice = 0,
    String photoBase64 = '',
  }) async {
    final doc = await _products.add({
      'house_id': houseId,
      'name': name,
      'name_lower': name.toLowerCase(),
      'category_id': categoryId,
      'unit': unit,
      'is_fixed': isFixed,
      'last_price': lastPrice,
      'photo_b64': photoBase64,
      'created_at': FieldValue.serverTimestamp(),
    });
    return doc.id;
  }

  Future<void> updateProduct({
    required String productId,
    required String name,
    required String categoryId,
    required String unit,
    required bool isFixed,
    double lastPrice = 0,
    String photoBase64 = '',
  }) {
    return _products.doc(productId).update({
      'name': name,
      'name_lower': name.toLowerCase(),
      'category_id': categoryId,
      'unit': unit,
      'is_fixed': isFixed,
      'last_price': lastPrice,
      'photo_b64': photoBase64,
    });
  }

  /// Guarda o último preço pago no produto, para sugerir na próxima compra.
  Future<void> recordProductPrice(String productId, double price) {
    if (productId.isEmpty || price <= 0) return Future.value();
    return _products.doc(productId).update({'last_price': price});
  }

  Future<void> deleteProduct(String productId) {
    return _products.doc(productId).delete();
  }

  // ---------------------------------------------------------------------
  // Itens
  // ---------------------------------------------------------------------

  /// Itens de uma lista específica.
  Stream<List<MarketItem>> itemsStream(String listId) {
    return _items.where('list_id', isEqualTo: listId).snapshots().map(
      (snap) {
        final items = snap.docs.map(MarketItem.fromFirestore).toList();
        items.sort((a, b) => a.createdAt.compareTo(b.createdAt));
        return items;
      },
    );
  }

  /// Todos os itens da casa — usado para contadores nas listas.
  Stream<List<MarketItem>> houseItemsStream(String houseId) {
    return _items
        .where('house_id', isEqualTo: houseId)
        .snapshots()
        .map((snap) => snap.docs.map(MarketItem.fromFirestore).toList());
  }

  Future<void> addItem({
    required String houseId,
    required String listId,
    required String name,
    required String addedBy,
    required String addedByName,
    String productId = '',
    String categoryId = '',
    double quantity = 1,
    String unit = 'un',
    double price = 0,
    String notes = '',
  }) {
    return _items.add({
      'house_id': houseId,
      'list_id': listId,
      'product_id': productId,
      'name': name,
      'category_id': categoryId,
      'quantity': quantity,
      'unit': unit,
      'price': price,
      'notes': notes,
      'bought': false,
      'added_by': addedBy,
      'added_by_name': addedByName,
      'created_at': FieldValue.serverTimestamp(),
    });
  }

  Future<void> toggleBought(String itemId, {required bool newValue}) {
    return _items.doc(itemId).update({'bought': newValue});
  }

  Future<void> updateItem(
    String itemId, {
    required double quantity,
    required double price,
  }) {
    return _items.doc(itemId).update({
      'quantity': quantity,
      'price': price,
    });
  }

  Future<void> deleteItem(String itemId) {
    return _items.doc(itemId).delete();
  }

  /// Remove de uma vez todos os itens já comprados da lista.
  Future<void> clearBought(String listId) async {
    final bought = await _items
        .where('list_id', isEqualTo: listId)
        .where('bought', isEqualTo: true)
        .get();
    final batch = _firestore.batch();
    for (final doc in bought.docs) {
      batch.delete(doc.reference);
    }
    await batch.commit();
  }

  /// Adiciona à lista todos os produtos fixos do catálogo que ainda não
  /// estão nela. Retorna quantos foram adicionados.
  Future<int> addFixedProducts({
    required String houseId,
    required String listId,
    required String addedBy,
    required String addedByName,
  }) async {
    final fixedSnap = await _products
        .where('house_id', isEqualTo: houseId)
        .where('is_fixed', isEqualTo: true)
        .get();
    if (fixedSnap.docs.isEmpty) return 0;

    final currentItems =
        await _items.where('list_id', isEqualTo: listId).get();
    final existingProductIds = currentItems.docs
        .map((d) => (d.data() as Map<String, dynamic>)['product_id'] as String?)
        .whereType<String>()
        .toSet();

    final batch = _firestore.batch();
    var added = 0;
    for (final doc in fixedSnap.docs) {
      if (existingProductIds.contains(doc.id)) continue;
      final product = MarketProduct.fromFirestore(doc);
      batch.set(_items.doc(), {
        'house_id': houseId,
        'list_id': listId,
        'product_id': product.id,
        'name': product.name,
        'category_id': product.categoryId,
        'quantity': 1,
        'unit': product.unit,
        'price': product.lastPrice,
        'notes': '',
        'bought': false,
        'added_by': addedBy,
        'added_by_name': addedByName,
        'created_at': FieldValue.serverTimestamp(),
      });
      added++;
    }
    if (added > 0) await batch.commit();
    return added;
  }
}
