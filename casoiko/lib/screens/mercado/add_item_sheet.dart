import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:casoiko/theme/app_colors.dart';

import '../../models/market_category.dart';
import '../../models/market_product.dart';
import '../../services/market_service.dart';
import '../../utils/currency.dart';
import '../../utils/market_catalog.dart';
import 'product_form_sheet.dart';
import 'products_screen.dart';

/// Dados do item escolhido no sheet, devolvidos para quem abriu.
class AddItemResult {
  const AddItemResult({
    required this.name,
    this.productId = '',
    this.categoryId = '',
    this.quantity = 1,
    this.unit = 'un',
    this.price = 0,
    this.notes = '',
  });

  final String name;
  final String productId;
  final String categoryId;
  final double quantity;
  final String unit;
  final double price;
  final String notes;
}

class AddItemSheet extends StatefulWidget {
  const AddItemSheet({
    super.key,
    required this.houseId,
    required this.marketService,
  });

  final String houseId;
  final MarketService marketService;

  @override
  State<AddItemSheet> createState() => _AddItemSheetState();
}

class _AddItemSheetState extends State<AddItemSheet> {
  final _searchController = TextEditingController();
  final _quantityController = TextEditingController(text: '1');
  final _priceController = TextEditingController();

  MarketProduct? _selectedProduct;
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    _quantityController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  void _selectProduct(MarketProduct product) {
    setState(() {
      _selectedProduct = product;
      _quantityController.text = '1';
      _priceController.text = product.lastPrice > 0
          ? product.lastPrice.toStringAsFixed(2).replaceAll('.', ',')
          : '';
    });
  }

  void _backToCatalog() {
    setState(() => _selectedProduct = null);
  }

  void _openCatalog() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ProductsScreen(
          houseId: widget.houseId,
          marketService: widget.marketService,
        ),
      ),
    );
  }

  Future<void> _registerProduct() async {
    final created = await showModalBottomSheet<MarketProduct>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ProductFormSheet(
        houseId: widget.houseId,
        marketService: widget.marketService,
      ),
    );
    if (created != null) _selectProduct(created);
  }

  void _submit() {
    final product = _selectedProduct;
    if (product == null) return;

    final quantity =
        double.tryParse(_quantityController.text.replaceAll(',', '.')) ?? 1;

    Navigator.of(context).pop(
      AddItemResult(
        name: product.name,
        productId: product.id,
        categoryId: product.categoryId,
        quantity: quantity <= 0 ? 1 : quantity,
        unit: product.unit,
        price: parsePrice(_priceController.text),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              _SheetHeader(
                showBack: _selectedProduct != null,
                onBack: _backToCatalog,
                onOpenCatalog: _openCatalog,
                onNewProduct: _registerProduct,
              ),
              Expanded(
                child: _selectedProduct == null
                    ? _CatalogStep(
                        houseId: widget.houseId,
                        marketService: widget.marketService,
                        scrollController: scrollController,
                        searchController: _searchController,
                        searchQuery: _searchQuery,
                        onSearchChanged: (value) {
                          setState(() => _searchQuery = value);
                        },
                        onSelectProduct: _selectProduct,
                        onRegisterProduct: _registerProduct,
                      )
                    : _ConfirmStep(
                        product: _selectedProduct!,
                        quantityController: _quantityController,
                        priceController: _priceController,
                        onSubmit: _submit,
                      ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _SheetHeader extends StatelessWidget {
  const _SheetHeader({
    required this.showBack,
    required this.onBack,
    required this.onOpenCatalog,
    required this.onNewProduct,
  });

  final bool showBack;
  final VoidCallback onBack;
  final VoidCallback onOpenCatalog;
  final VoidCallback onNewProduct;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 12, 8, 8),
      child: Row(
        children: [
          if (showBack)
            IconButton(
              tooltip: 'Voltar ao catálogo',
              onPressed: onBack,
              icon: const Icon(Icons.arrow_back),
            )
          else
            const SizedBox(width: 8),
          const Expanded(
            child: Text(
              'Adicionar item',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          IconButton(
            tooltip: 'Catálogo de produtos',
            onPressed: onOpenCatalog,
            icon: const Icon(Icons.inventory_2_outlined),
            color: AppColors.primary,
          ),
          IconButton(
            tooltip: 'Cadastrar produto',
            onPressed: onNewProduct,
            icon: const Icon(Icons.add_circle_outline),
            color: AppColors.primary,
          ),
        ],
      ),
    );
  }
}

class _CatalogStep extends StatelessWidget {
  const _CatalogStep({
    required this.houseId,
    required this.marketService,
    required this.scrollController,
    required this.searchController,
    required this.searchQuery,
    required this.onSearchChanged,
    required this.onSelectProduct,
    required this.onRegisterProduct,
  });

  final String houseId;
  final MarketService marketService;
  final ScrollController scrollController;
  final TextEditingController searchController;
  final String searchQuery;
  final ValueChanged<String> onSearchChanged;
  final ValueChanged<MarketProduct> onSelectProduct;
  final VoidCallback onRegisterProduct;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 12),
          child: TextField(
            controller: searchController,
            onChanged: onSearchChanged,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              hintText: 'Buscar no catálogo...',
              prefixIcon: const Icon(Icons.search, size: 22),
              filled: true,
              fillColor: AppColors.surfaceMuted,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(
                  color: AppColors.primary,
                  width: 1.5,
                ),
              ),
            ),
          ),
        ),
        Expanded(
          child: StreamBuilder<List<MarketCategory>>(
            stream: marketService.categoriesStream(houseId),
            builder: (context, catSnap) {
              final categories = catSnap.data ?? [];

              return StreamBuilder<List<MarketProduct>>(
                stream: marketService.productsStream(houseId),
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting &&
                      !snap.hasData) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  if (snap.hasError) {
                    return Center(child: Text('Erro: ${snap.error}'));
                  }

                  final allProducts = snap.data ?? [];
                  if (allProducts.isEmpty) {
                    return _CatalogEmptyState(
                      onRegisterProduct: onRegisterProduct,
                    );
                  }

                  final filtered =
                      filterProductsByQuery(allProducts, searchQuery);
                  if (filtered.isEmpty) {
                    return const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Text(
                          'Nenhum produto encontrado.',
                          style: TextStyle(color: AppColors.textSecondary),
                        ),
                      ),
                    );
                  }

                  final groups =
                      groupProductsByCategory(categories, filtered);

                  return ListView(
                    controller: scrollController,
                    padding: const EdgeInsets.only(bottom: 24),
                    children: [
                      for (final group in groups)
                        _CatalogCategoryCarousel(
                          group: group,
                          onSelectProduct: onSelectProduct,
                        ),
                    ],
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}

class _ConfirmStep extends StatelessWidget {
  const _ConfirmStep({
    required this.product,
    required this.quantityController,
    required this.priceController,
    required this.onSubmit,
  });

  final MarketProduct product;
  final TextEditingController quantityController;
  final TextEditingController priceController;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        24,
        0,
        24,
        24 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                _ProductThumb(
                  photoBase64: product.photoBase64,
                  rounded: true,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        product.name,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Unidade: ${product.unit}',
                        style: TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary.withValues(alpha: 0.85),
                        ),
                      ),
                    ],
                  ),
                ),
                if (product.isFixed)
                  const Icon(
                    Icons.push_pin,
                    size: 18,
                    color: AppColors.primary,
                  ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              SizedBox(
                width: 100,
                child: TextField(
                  controller: quantityController,
                  autofocus: true,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  textAlign: TextAlign.center,
                  decoration: InputDecoration(
                    labelText: 'Qtd',
                    filled: true,
                    fillColor: AppColors.surfaceMuted,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: priceController,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: InputDecoration(
                    labelText: 'Preço (R\$)',
                    hintText: '0,00',
                    filled: true,
                    fillColor: AppColors.surfaceMuted,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          SizedBox(
            height: 52,
            child: FilledButton(
              onPressed: onSubmit,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: const Text(
                'Adicionar',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CatalogCategoryCarousel extends StatelessWidget {
  const _CatalogCategoryCarousel({
    required this.group,
    required this.onSelectProduct,
  });

  static const _cardWidth = 108.0;
  static const _textAreaHeight = 64.0;
  static double get _carouselHeight => _cardWidth + _textAreaHeight;

  final ProductCatalogGroup group;
  final ValueChanged<MarketProduct> onSelectProduct;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 10),
          child: _CatalogSectionHeader(
            icon: group.icon,
            name: group.name,
          ),
        ),
        SizedBox(
          height: _carouselHeight,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: group.items.length,
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (context, index) {
              final product = group.items[index];
              return _CatalogProductCard(
                product: product,
                width: _cardWidth,
                onTap: () => onSelectProduct(product),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _CatalogSectionHeader extends StatelessWidget {
  const _CatalogSectionHeader({
    required this.icon,
    required this.name,
  });

  final IconData icon;
  final String name;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, top: 4, bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 14, color: AppColors.textSecondary),
          const SizedBox(width: 6),
          Text(
            name.toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _CatalogProductCard extends StatelessWidget {
  const _CatalogProductCard({
    required this.product,
    required this.width,
    required this.onTap,
  });

  final MarketProduct product;
  final double width;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          width: width,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                width: width,
                height: width,
                child: Stack(
                  children: [
                    ClipRRect(
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(13),
                      ),
                      child: _ProductThumb(
                        photoBase64: product.photoBase64,
                        size: width,
                        fit: BoxFit.cover,
                      ),
                    ),
                    if (product.isFixed)
                      Positioned(
                        top: 6,
                        right: 6,
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.9),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.push_pin,
                            size: 11,
                            color: Colors.white,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
                child: Column(
                  children: [
                    Text(
                      product.lastPrice > 0
                          ? formatPrice(product.lastPrice)
                          : '—',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: AppColors.primary,
                        height: 1.1,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      product.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        height: 1.15,
                        color: AppColors.textSecondary.withValues(alpha: 0.9),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProductThumb extends StatelessWidget {
  const _ProductThumb({
    required this.photoBase64,
    this.size = 48,
    this.fit = BoxFit.cover,
    this.rounded = false,
  });

  final String photoBase64;
  final double size;
  final BoxFit fit;
  final bool rounded;

  @override
  Widget build(BuildContext context) {
    final image = photoBase64.isNotEmpty
        ? Image.memory(
            base64Decode(photoBase64),
            fit: fit,
            width: size,
            height: size,
          )
        : Center(
            child: Icon(
              Icons.image_outlined,
              size: size > 64 ? 28 : 20,
              color: AppColors.textSecondary,
            ),
          );

    return ClipRRect(
      borderRadius: rounded
          ? BorderRadius.circular(10)
          : BorderRadius.zero,
      child: SizedBox(
        width: size,
        height: size,
        child: ColoredBox(
          color: AppColors.surfaceMuted,
          child: image,
        ),
      ),
    );
  }
}

class _CatalogEmptyState extends StatelessWidget {
  const _CatalogEmptyState({required this.onRegisterProduct});

  final VoidCallback onRegisterProduct;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.inventory_2_outlined,
              size: 56,
              color: AppColors.primary,
            ),
            const SizedBox(height: 16),
            const Text(
              'Catálogo vazio',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Cadastre os produtos que a casa costuma comprar.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: onRegisterProduct,
              icon: const Icon(Icons.add),
              label: const Text('Cadastrar primeiro produto'),
            ),
          ],
        ),
      ),
    );
  }
}
