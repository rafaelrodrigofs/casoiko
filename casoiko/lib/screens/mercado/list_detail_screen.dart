import 'dart:convert';

import 'package:flutter/material.dart';

import '../../models/market_category.dart';
import '../../models/market_item.dart';
import '../../models/market_list.dart';
import '../../models/market_product.dart';
import '../../services/auth_service.dart';
import '../../services/market_service.dart';
import '../../utils/currency.dart';
import 'add_item_sheet.dart';

class ListDetailScreen extends StatelessWidget {
  const ListDetailScreen({
    super.key,
    required this.list,
    required this.houseId,
    required this.authService,
    required this.marketService,
  });

  final MarketList list;
  final String houseId;
  final AuthService authService;
  final MarketService marketService;

  Future<void> _openAddSheet(BuildContext context) async {
    final result = await showModalBottomSheet<AddItemResult>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => AddItemSheet(
        houseId: houseId,
        marketService: marketService,
      ),
    );

    if (result == null) return;

    final user = authService.currentUser;
    await marketService.addItem(
      houseId: houseId,
      listId: list.id,
      name: result.name,
      productId: result.productId,
      categoryId: result.categoryId,
      quantity: result.quantity,
      unit: result.unit,
      price: result.price,
      notes: result.notes,
      addedBy: user?.uid ?? '',
      addedByName: user?.displayName ?? 'Alguém',
    );
    await marketService.recordProductPrice(result.productId, result.price);
  }

  Future<void> _editItem(BuildContext context, MarketItem item) async {
    final result = await showDialog<(double, double)>(
      context: context,
      builder: (_) => _EditItemDialog(item: item),
    );
    if (result == null) return;

    final (quantity, price) = result;
    await marketService.updateItem(item.id, quantity: quantity, price: price);
    await marketService.recordProductPrice(item.productId, price);
  }

  Future<void> _addFixedProducts(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    final user = authService.currentUser;
    final added = await marketService.addFixedProducts(
      houseId: houseId,
      listId: list.id,
      addedBy: user?.uid ?? '',
      addedByName: user?.displayName ?? 'Alguém',
    );

    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          content: Text(
            added == 0
                ? 'Nenhum produto fixo para adicionar. Cadastre produtos fixos no catálogo.'
                : '$added produto${added > 1 ? 's' : ''} fixo${added > 1 ? 's' : ''} adicionado${added > 1 ? 's' : ''}.',
          ),
        ),
      );
  }

  Future<void> _clearBought(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Limpar comprados?'),
        content: const Text(
          'Todos os itens marcados como comprados serão removidos da lista.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF3D5A4C),
            ),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Limpar'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await marketService.clearBought(list.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0E8),
      appBar: AppBar(
        backgroundColor: const Color(0xFF3D5A4C),
        foregroundColor: Colors.white,
        title: Text('${list.emoji} ${list.name}'),
        actions: [
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'fixed') _addFixedProducts(context);
              if (value == 'clear') _clearBought(context);
            },
            itemBuilder: (_) => const [
              PopupMenuItem(
                value: 'fixed',
                child: Row(
                  children: [
                    Icon(Icons.push_pin_outlined, size: 20),
                    SizedBox(width: 10),
                    Text('Adicionar fixos'),
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'clear',
                child: Row(
                  children: [
                    Icon(Icons.cleaning_services_outlined, size: 20),
                    SizedBox(width: 10),
                    Text('Limpar comprados'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: StreamBuilder<List<MarketCategory>>(
        stream: marketService.categoriesStream(houseId),
        builder: (context, catSnap) {
          final categories = catSnap.data ?? [];

          return StreamBuilder<List<MarketProduct>>(
            stream: marketService.productsStream(houseId),
            builder: (context, prodSnap) {
              final photoByProductId = {
                for (final product in prodSnap.data ?? <MarketProduct>[])
                  if (product.photoBase64.isNotEmpty)
                    product.id: product.photoBase64,
              };

              return _buildItems(context, categories, photoByProductId);
            },
          );
        },
      ),
    );
  }

  Widget _buildBottomBar(
    BuildContext context, {
    required double cartTotal,
    required double pendingTotal,
    required bool hasPrices,
  }) {
    return _ListBottomBar(
      cartTotal: cartTotal,
      pendingTotal: pendingTotal,
      hasPrices: hasPrices,
      onAdd: () => _openAddSheet(context),
    );
  }

  Widget _buildItems(
    BuildContext context,
    List<MarketCategory> categories,
    Map<String, String> photoByProductId,
  ) {
    return StreamBuilder<List<MarketItem>>(
      stream: marketService.itemsStream(list.id),
      builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }

              if (snap.hasError) {
                return Center(child: Text('Erro: ${snap.error}'));
              }

              final items = snap.data ?? [];

              if (items.isEmpty) {
                return Column(
                  children: [
                    const Expanded(child: _EmptyState()),
                    _buildBottomBar(
                      context,
                      cartTotal: 0,
                      pendingTotal: 0,
                      hasPrices: false,
                    ),
                  ],
                );
              }

              final pending = items.where((i) => !i.bought).toList();
              final bought = items.where((i) => i.bought).toList();

              // Agrupa pendentes por categoria, na ordem das categorias.
              final categoryIds = categories.map((c) => c.id).toSet();
              final groups = <(String, List<MarketItem>)>[];
              for (final category in categories) {
                final group = pending
                    .where((i) => i.categoryId == category.id)
                    .toList();
                if (group.isNotEmpty) {
                  groups.add(('${category.emoji} ${category.name}', group));
                }
              }
              final uncategorized = pending
                  .where((i) => !categoryIds.contains(i.categoryId))
                  .toList();
              if (uncategorized.isNotEmpty) {
                groups.add(('📦 Sem categoria', uncategorized));
              }

              final cartTotal = bought.fold<double>(
                0,
                (sum, item) => sum + item.subtotal,
              );
              final pendingTotal = pending.fold<double>(
                0,
                (sum, item) => sum + item.subtotal,
              );
              final hasPrices = cartTotal > 0 || pendingTotal > 0;

              return Column(
                children: [
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      children: [
                        for (final (label, group) in groups) ...[
                          _SectionHeader(label: label),
                          ...group.map(
                            (item) => _buildTile(
                              context,
                              item,
                              photoByProductId,
                            ),
                          ),
                          const SizedBox(height: 4),
                        ],
                        if (bought.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          _SectionHeader(
                            label: 'Comprado (${bought.length})',
                            faded: true,
                          ),
                          ...bought.map(
                            (item) => _buildTile(
                              context,
                              item,
                              photoByProductId,
                            ),
                          ),
                        ],
                        const SizedBox(height: 16),
                      ],
                    ),
                  ),
                  _buildBottomBar(
                    context,
                    cartTotal: cartTotal,
                    pendingTotal: pendingTotal,
                    hasPrices: hasPrices,
                  ),
                ],
              );
      },
    );
  }

  Widget _buildTile(
    BuildContext context,
    MarketItem item,
    Map<String, String> photoByProductId,
  ) {
    return _ItemTile(
      key: ValueKey(item.id),
      item: item,
      photoBase64: photoByProductId[item.productId] ?? '',
      onToggle: () =>
          marketService.toggleBought(item.id, newValue: !item.bought),
      onDelete: () => marketService.deleteItem(item.id),
      onTap: () => _editItem(context, item),
    );
  }
}

// ---------------------------------------------------------------------------
// Widgets internos
// ---------------------------------------------------------------------------

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.label, this.faded = false});

  final String label;
  final bool faded;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, top: 4, bottom: 8),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.8,
          color: faded
              ? const Color(0xFF5C6658).withValues(alpha: 0.5)
              : const Color(0xFF5C6658),
        ),
      ),
    );
  }
}

class _ItemTile extends StatelessWidget {
  const _ItemTile({
    super.key,
    required this.item,
    required this.photoBase64,
    required this.onToggle,
    required this.onDelete,
    required this.onTap,
  });

  final MarketItem item;
  final String photoBase64;
  final VoidCallback onToggle;
  final VoidCallback onDelete;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final subtitleParts = <String>[
      if (item.notes.isNotEmpty) item.notes,
      if (item.addedByName.isNotEmpty) item.addedByName,
    ];

    return Dismissible(
      key: ValueKey(item.id),
      direction: DismissDirection.endToStart,
      background: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: Colors.red[400],
          borderRadius: BorderRadius.circular(14),
        ),
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        child: const Icon(Icons.delete_outline, color: Colors.white, size: 22),
      ),
      onDismissed: (_) => onDelete(),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: item.bought
              ? Colors.white.withValues(alpha: 0.55)
              : Colors.white,
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
              const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
          onTap: onTap,
          leading: Checkbox(
            value: item.bought,
            onChanged: (_) => onToggle(),
            activeColor: const Color(0xFF3D5A4C),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(6),
            ),
          ),
          title: Row(
            children: [
              if (photoBase64.isNotEmpty) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Opacity(
                    opacity: item.bought ? 0.5 : 1,
                    child: Image.memory(
                      base64Decode(photoBase64),
                      width: 34,
                      height: 34,
                      fit: BoxFit.cover,
                      gaplessPlayback: true,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
              ],
              Expanded(
                child: Text(
                  item.name,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: item.bought
                        ? const Color(0xFF5C6658).withValues(alpha: 0.55)
                        : const Color(0xFF2F3A2E),
                    decoration:
                        item.bought ? TextDecoration.lineThrough : null,
                    decorationColor:
                        const Color(0xFF5C6658).withValues(alpha: 0.55),
                  ),
                ),
              ),
            ],
          ),
          subtitle: subtitleParts.isNotEmpty
              ? Text(
                  subtitleParts.join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12,
                    color: const Color(0xFF5C6658).withValues(alpha: 0.65),
                  ),
                )
              : null,
          trailing: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFF5F0E8),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  item.quantityLabel,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: item.bought
                        ? const Color(0xFF5C6658).withValues(alpha: 0.55)
                        : const Color(0xFF3D5A4C),
                  ),
                ),
              ),
              if (item.subtotal > 0)
                Padding(
                  padding: const EdgeInsets.only(top: 3, right: 2),
                  child: Text(
                    formatPrice(item.subtotal),
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: item.bought
                          ? const Color(0xFF5C6658).withValues(alpha: 0.55)
                          : const Color(0xFF5C6658),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ListBottomBar extends StatelessWidget {
  const _ListBottomBar({
    required this.cartTotal,
    required this.pendingTotal,
    required this.hasPrices,
    required this.onAdd,
  });

  final double cartTotal;
  final double pendingTotal;
  final bool hasPrices;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 16, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            if (hasPrices) ...[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'NO CARRINHO',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.8,
                        color: Color(0xFF5C6658),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      formatPrice(cartTotal),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF3D5A4C),
                      ),
                    ),
                  ],
                ),
              ),
              if (pendingTotal > 0) ...[
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text(
                      'FALTA (ESTIMADO)',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.8,
                        color: Color(0xFF5C6658),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      formatPrice(pendingTotal),
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color:
                            const Color(0xFF5C6658).withValues(alpha: 0.85),
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(width: 12),
            ] else
              const Spacer(),
            FloatingActionButton(
              onPressed: onAdd,
              backgroundColor: const Color(0xFF3D5A4C),
              foregroundColor: Colors.white,
              tooltip: 'Adicionar item',
              elevation: 0,
              child: const Icon(Icons.add),
            ),
          ],
        ),
      ),
    );
  }
}

class _EditItemDialog extends StatefulWidget {
  const _EditItemDialog({required this.item});

  final MarketItem item;

  @override
  State<_EditItemDialog> createState() => _EditItemDialogState();
}

class _EditItemDialogState extends State<_EditItemDialog> {
  late final TextEditingController _quantityController;
  late final TextEditingController _priceController;

  @override
  void initState() {
    super.initState();
    final item = widget.item;
    final quantity = item.quantity == item.quantity.roundToDouble()
        ? item.quantity.toInt().toString()
        : item.quantity.toString();
    _quantityController = TextEditingController(text: quantity);
    _priceController = TextEditingController(
      text: item.price > 0
          ? item.price.toStringAsFixed(2).replaceAll('.', ',')
          : '',
    );
  }

  @override
  void dispose() {
    _quantityController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  void _submit() {
    final quantity =
        double.tryParse(_quantityController.text.replaceAll(',', '.')) ?? 1;
    final price = parsePrice(_priceController.text);
    Navigator.of(context).pop((quantity <= 0 ? 1.0 : quantity, price));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.item.name),
      content: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _quantityController,
              autofocus: true,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              textAlign: TextAlign.center,
              decoration: InputDecoration(
                labelText: 'Qtd (${widget.item.unit})',
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              controller: _priceController,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              textAlign: TextAlign.center,
              decoration: const InputDecoration(
                labelText: 'Preço (R\$)',
                hintText: '0,00',
              ),
              onSubmitted: (_) => _submit(),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFF3D5A4C),
          ),
          onPressed: _submit,
          child: const Text('Salvar'),
        ),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.shopping_basket_outlined,
              size: 72,
              color: Color(0xFF3D5A4C),
            ),
            SizedBox(height: 20),
            Text(
              'Lista vazia!',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: Color(0xFF2F3A2E),
              ),
            ),
            SizedBox(height: 8),
            Text(
              'Toque no + para adicionar o que precisa comprar.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 15,
                color: Color(0xFF5C6658),
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
