import 'package:flutter/material.dart';

import '../../models/market_product.dart';
import '../../services/market_service.dart';
import '../../utils/currency.dart';
import 'product_form_sheet.dart';

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
  final _nameController = TextEditingController();
  final _notesController = TextEditingController();
  final _quantityController = TextEditingController(text: '1');
  final _priceController = TextEditingController();

  MarketProduct? _selectedProduct;
  String _unit = 'un';

  @override
  void dispose() {
    _nameController.dispose();
    _notesController.dispose();
    _quantityController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  void _selectProduct(MarketProduct product) {
    setState(() {
      _selectedProduct = product;
      _nameController.text = product.name;
      _unit = product.unit;
      if (product.lastPrice > 0) {
        _priceController.text =
            product.lastPrice.toStringAsFixed(2).replaceAll('.', ',');
      }
    });
  }

  void _clearSelection() {
    setState(() => _selectedProduct = null);
  }

  Future<void> _registerProduct() async {
    final typedName = _nameController.text.trim();
    final created = await showModalBottomSheet<MarketProduct>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ProductFormSheet(
        houseId: widget.houseId,
        marketService: widget.marketService,
        initialName: typedName,
      ),
    );
    if (created != null) _selectProduct(created);
  }

  void _submit() {
    final name = _nameController.text.trim();
    if (name.isEmpty) return;

    final quantity =
        double.tryParse(_quantityController.text.replaceAll(',', '.')) ?? 1;

    Navigator.of(context).pop(
      AddItemResult(
        name: name,
        productId: _selectedProduct?.id ?? '',
        categoryId: _selectedProduct?.categoryId ?? '',
        quantity: quantity <= 0 ? 1 : quantity,
        unit: _unit,
        price: parsePrice(_priceController.text),
        notes: _notesController.text.trim(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Adicionar item',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: Color(0xFF2F3A2E),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _nameController,
              autofocus: true,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                hintText: 'Ex: Café, Arroz, Sabão...',
                filled: true,
                fillColor: const Color(0xFFF5F0E8),
                suffixIcon: _selectedProduct != null
                    ? IconButton(
                        icon: const Icon(Icons.close, size: 20),
                        onPressed: _clearSelection,
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(
                    color: Color(0xFF3D5A4C),
                    width: 1.5,
                  ),
                ),
              ),
              onChanged: (_) {
                if (_selectedProduct != null &&
                    _nameController.text != _selectedProduct!.name) {
                  _clearSelection();
                } else {
                  setState(() {});
                }
              },
              onSubmitted: (_) => _submit(),
            ),
            StreamBuilder<List<MarketProduct>>(
              stream: widget.marketService.productsStream(widget.houseId),
              builder: (context, snap) {
                final query = _nameController.text.trim().toLowerCase();
                final products = snap.data ?? [];

                if (_selectedProduct != null || query.isEmpty) {
                  return const SizedBox.shrink();
                }

                final matches = products
                    .where((p) => p.name.toLowerCase().contains(query))
                    .take(4)
                    .toList();

                final hasExact =
                    matches.any((p) => p.name.toLowerCase() == query);

                if (matches.isEmpty && query.length < 2) {
                  return const SizedBox.shrink();
                }

                return Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ...matches.map(
                        (product) => ActionChip(
                          avatar: product.isFixed
                              ? const Icon(Icons.push_pin, size: 14)
                              : null,
                          label: Text(product.name),
                          backgroundColor: const Color(0xFFF5F0E8),
                          side: BorderSide.none,
                          onPressed: () => _selectProduct(product),
                        ),
                      ),
                      if (!hasExact)
                        ActionChip(
                          avatar: const Icon(Icons.add, size: 16),
                          label: const Text('Cadastrar produto'),
                          backgroundColor:
                              const Color(0xFF3D5A4C).withValues(alpha: 0.1),
                          side: BorderSide.none,
                          onPressed: _registerProduct,
                        ),
                    ],
                  ),
                );
              },
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                SizedBox(
                  width: 100,
                  child: TextField(
                    controller: _quantityController,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    textAlign: TextAlign.center,
                    decoration: InputDecoration(
                      labelText: 'Qtd',
                      filled: true,
                      fillColor: const Color(0xFFF5F0E8),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _unit,
                    decoration: InputDecoration(
                      labelText: 'Unidade',
                      filled: true,
                      fillColor: const Color(0xFFF5F0E8),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                    ),
                    items: kMarketUnits
                        .map(
                          (unit) => DropdownMenuItem(
                            value: unit,
                            child: Text(unit),
                          ),
                        )
                        .toList(),
                    onChanged: (value) =>
                        setState(() => _unit = value ?? 'un'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _priceController,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: InputDecoration(
                      labelText: 'Preço (R\$)',
                      hintText: '0,00',
                      filled: true,
                      fillColor: const Color(0xFFF5F0E8),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _notesController,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                hintText: 'Observação (marca, sem lactose...)',
                filled: true,
                fillColor: const Color(0xFFF5F0E8),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
              onSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: FilledButton(
                onPressed: _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF3D5A4C),
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
      ),
    );
  }
}
