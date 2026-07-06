import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:casoiko/theme/app_colors.dart';

import '../../models/market_category.dart';
import '../../models/market_product.dart';
import '../../services/market_service.dart';
import '../../utils/app_icons.dart';
import '../../utils/currency.dart';
import 'product_detail_screen.dart';
import 'product_form_sheet.dart';

class ProductsScreen extends StatelessWidget {
  const ProductsScreen({
    super.key,
    required this.houseId,
    required this.marketService,
  });

  final String houseId;
  final MarketService marketService;

  void _openDetail(BuildContext context, MarketProduct product) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ProductDetailScreen(
          product: product,
          houseId: houseId,
          marketService: marketService,
        ),
      ),
    );
  }

  Future<void> _openForm(BuildContext context) {
    return showModalBottomSheet<MarketProduct>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ProductFormSheet(
        houseId: houseId,
        marketService: marketService,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Catálogo de produtos'),
      ),
      body: StreamBuilder<List<MarketCategory>>(
        stream: marketService.categoriesStream(houseId),
        builder: (context, catSnap) {
          final categories = catSnap.data ?? [];

          return StreamBuilder<List<MarketProduct>>(
            stream: marketService.productsStream(houseId),
            builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }

              if (snap.hasError) {
                return Center(child: Text('Erro: ${snap.error}'));
              }

              final products = snap.data ?? [];

              if (products.isEmpty) {
                return const _EmptyState();
              }

              final categoryIds = categories.map((c) => c.id).toSet();
              final groups = <({IconData icon, String name, List<MarketProduct> items})>[];
              for (final category in categories) {
                final group = products
                    .where((p) => p.categoryId == category.id)
                    .toList();
                if (group.isNotEmpty) {
                  groups.add((
                    icon: AppIcons.fromCode(category.iconCode),
                    name: category.name,
                    items: group,
                  ));
                }
              }
              final uncategorized = products
                  .where((p) => !categoryIds.contains(p.categoryId))
                  .toList();
              if (uncategorized.isNotEmpty) {
                groups.add((
                  icon: AppIcons.defaultCategory,
                  name: 'Sem categoria',
                  items: uncategorized,
                ));
              }

              return ListView(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                children: [
                  for (final group in groups) ...[
                    _SectionHeader(icon: group.icon, name: group.name),
                    ...group.items.map(
                      (product) => _ProductTile(
                        key: ValueKey(product.id),
                        product: product,
                        onTap: () => _openDetail(context, product),
                        onDelete: () =>
                            marketService.deleteProduct(product.id),
                      ),
                    ),
                    const SizedBox(height: 4),
                  ],
                  const SizedBox(height: 80),
                ],
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(context),
        icon: Icon(Icons.add),
        label: const Text('Novo produto'),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Widgets internos
// ---------------------------------------------------------------------------

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.icon, required this.name});

  final IconData icon;
  final String name;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.only(left: 4, top: 4, bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 14, color: colors.textSecondary),
          const SizedBox(width: 6),
          Text(
            name.toUpperCase(),
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
              color: colors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductTile extends StatelessWidget {
  const _ProductTile({
    super.key,
    required this.product,
    required this.onTap,
    required this.onDelete,
  });

  final MarketProduct product;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Dismissible(
      key: ValueKey(product.id),
      direction: DismissDirection.endToStart,
      background: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: Colors.red[400],
          borderRadius: BorderRadius.circular(14),
        ),
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        child: Icon(Icons.delete_outline, color: Colors.white, size: 22),
      ),
      onDismissed: (_) => onDelete(),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: ListTile(
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          onTap: onTap,
          leading: Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: colors.surfaceMuted,
              borderRadius: BorderRadius.circular(10),
              image: product.photoBase64.isNotEmpty
                  ? DecorationImage(
                      image: MemoryImage(base64Decode(product.photoBase64)),
                      fit: BoxFit.cover,
                    )
                  : null,
            ),
            child: product.photoBase64.isEmpty
                ? Icon(
                    Icons.image_outlined,
                    size: 20,
                    color: colors.textSecondary,
                  )
                : null,
          ),
          title: Text(
            product.name,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w500,
              color: colors.textPrimary,
            ),
          ),
          subtitle: Text(
            product.lastPrice > 0
                ? 'Unidade: ${product.unit} · Último preço: ${formatPrice(product.lastPrice)}'
                : 'Unidade: ${product.unit}',
            style: TextStyle(
              fontSize: 12,
              color: colors.textSecondary.withValues(alpha: 0.65),
            ),
          ),
          trailing: product.isFixed
              ? Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: colors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.push_pin,
                        size: 13,
                        color: colors.primary,
                      ),
                      SizedBox(width: 4),
                      Text(
                        'Fixo',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: colors.primary,
                        ),
                      ),
                    ],
                  ),
                )
              : null,
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.inventory_2_outlined,
              size: 72,
              color: colors.primary,
            ),
            SizedBox(height: 20),
            Text(
              'Catálogo vazio',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: colors.textPrimary,
              ),
            ),
            SizedBox(height: 8),
            Text(
              'Cadastre os produtos que a casa costuma comprar.\nProdutos fixos entram na lista com um toque.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 15,
                color: colors.textSecondary,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
