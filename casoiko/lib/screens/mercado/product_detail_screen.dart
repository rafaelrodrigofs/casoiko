import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:casoiko/theme/app_colors.dart';

import '../../models/market_category.dart';
import '../../models/market_product.dart';
import '../../services/market_service.dart';
import '../../utils/app_icons.dart';
import '../../utils/currency.dart';
import 'product_form_sheet.dart';

class ProductDetailScreen extends StatefulWidget {
  const ProductDetailScreen({
    super.key,
    required this.product,
    required this.houseId,
    required this.marketService,
  });

  final MarketProduct product;
  final String houseId;
  final MarketService marketService;

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  late MarketProduct _product;

  @override
  void initState() {
    super.initState();
    _product = widget.product;
  }

  ({IconData icon, String name}) _categoryInfo(List<MarketCategory> categories) {
    final match = categories.where((c) => c.id == _product.categoryId);
    if (match.isEmpty) {
      return (icon: AppIcons.defaultCategory, name: 'Sem categoria');
    }
    final category = match.first;
    return (
      icon: AppIcons.fromCode(category.iconCode),
      name: category.name,
    );
  }

  Future<void> _openEdit() async {
    final updated = await showModalBottomSheet<MarketProduct>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ProductFormSheet(
        houseId: widget.houseId,
        marketService: widget.marketService,
        product: _product,
      ),
    );
    if (updated != null && mounted) {
      setState(() => _product = updated);
    }
  }

  Future<void> _confirmDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Apagar "${_product.name}"?'),
        content: const Text(
          'O produto será removido do catálogo. Itens já adicionados em listas não são apagados.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Apagar'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      await widget.marketService.deleteProduct(_product.id);
      if (mounted) Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<MarketCategory>>(
      stream: widget.marketService.categoriesStream(widget.houseId),
      builder: (context, snap) {
        final categories = snap.data ?? [];
        final categoryInfo = _categoryInfo(categories);

        return Scaffold(
          appBar: AppBar(
            title: const Text('Produto'),
            actions: [
              IconButton(
                tooltip: 'Editar',
                icon: const Icon(Icons.edit_outlined),
                onPressed: _openEdit,
              ),
              IconButton(
                tooltip: 'Apagar',
                icon: const Icon(Icons.delete_outline),
                onPressed: _confirmDelete,
              ),
            ],
          ),
          body: Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _PhotoHero(photoBase64: _product.photoBase64),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Text(
                                    _product.name,
                                    style: const TextStyle(
                                      fontSize: 26,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.textPrimary,
                                      height: 1.2,
                                    ),
                                  ),
                                ),
                                if (_product.isFixed)
                                  Container(
                                    margin: const EdgeInsets.only(left: 12),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 6,
                                    ),
                                    decoration: BoxDecoration(
                                      color: AppColors.primarySoft,
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: const Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          Icons.push_pin,
                                          size: 14,
                                          color: AppColors.primary,
                                        ),
                                        SizedBox(width: 4),
                                        Text(
                                          'Fixo',
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.primary,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceMuted,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    categoryInfo.icon,
                                    size: 16,
                                    color: AppColors.textSecondary,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    categoryInfo.name,
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 24),
                            _InfoCard(
                              children: [
                                _InfoRow(
                                  icon: Icons.straighten_outlined,
                                  label: 'Unidade padrão',
                                  value: _product.unit,
                                ),
                                const Divider(height: 24),
                                _InfoRow(
                                  icon: Icons.payments_outlined,
                                  label: 'Último preço',
                                  value: _product.lastPrice > 0
                                      ? formatPrice(_product.lastPrice)
                                      : 'Não registrado',
                                ),
                                const Divider(height: 24),
                                _InfoRow(
                                  icon: Icons.shopping_bag_outlined,
                                  label: 'Tipo de compra',
                                  value: _product.isFixed
                                      ? 'Fixo — entra com "Adicionar fixos"'
                                      : 'Variável — compra eventual',
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                  child: SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: FilledButton.icon(
                      onPressed: _openEdit,
                      icon: const Icon(Icons.edit_outlined, size: 20),
                      label: const Text(
                        'Editar produto',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _PhotoHero extends StatelessWidget {
  const _PhotoHero({required this.photoBase64});

  final String photoBase64;

  @override
  Widget build(BuildContext context) {
    final hasPhoto = photoBase64.isNotEmpty;

    return AspectRatio(
      aspectRatio: 1.1,
      child: Container(
        color: AppColors.surfaceMuted,
        child: hasPhoto
            ? Image.memory(
                base64Decode(photoBase64),
                fit: BoxFit.cover,
                width: double.infinity,
              )
            : const Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.image_outlined,
                    size: 64,
                    color: AppColors.textSecondary,
                  ),
                  SizedBox(height: 12),
                  Text(
                    'Sem foto',
                    style: TextStyle(
                      fontSize: 15,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(children: children),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 22, color: AppColors.primary),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
