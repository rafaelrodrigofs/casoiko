import 'package:flutter/material.dart';

import '../models/market_category.dart';
import '../models/market_product.dart';
import 'app_icons.dart';

typedef ProductCatalogGroup = ({
  IconData icon,
  String name,
  List<MarketProduct> items,
});

/// Agrupa produtos por categoria (mesma lógica do catálogo).
List<ProductCatalogGroup> groupProductsByCategory(
  List<MarketCategory> categories,
  List<MarketProduct> products,
) {
  final categoryIds = categories.map((c) => c.id).toSet();
  final groups = <ProductCatalogGroup>[];

  for (final category in categories) {
    final group =
        products.where((p) => p.categoryId == category.id).toList();
    if (group.isNotEmpty) {
      groups.add((
        icon: AppIcons.fromCode(category.iconCode),
        name: category.name,
        items: group,
      ));
    }
  }

  final uncategorized =
      products.where((p) => !categoryIds.contains(p.categoryId)).toList();
  if (uncategorized.isNotEmpty) {
    groups.add((
      icon: AppIcons.defaultCategory,
      name: 'Sem categoria',
      items: uncategorized,
    ));
  }

  return groups;
}

/// Filtra produtos pelo termo de busca (nome).
List<MarketProduct> filterProductsByQuery(
  List<MarketProduct> products,
  String query,
) {
  final normalized = query.trim().toLowerCase();
  if (normalized.isEmpty) return products;
  return products
      .where((p) => p.name.toLowerCase().contains(normalized))
      .toList();
}
