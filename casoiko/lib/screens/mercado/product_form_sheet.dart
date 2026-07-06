import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:casoiko/theme/app_colors.dart';

import 'package:image_picker/image_picker.dart';

import '../../models/market_category.dart';
import '../../models/market_product.dart';
import '../../services/market_service.dart';
import '../../utils/app_icons.dart';
import '../../utils/currency.dart';

/// Cria ou edita um produto do catálogo. Devolve o [MarketProduct] salvo.
class ProductFormSheet extends StatefulWidget {
  const ProductFormSheet({
    super.key,
    required this.houseId,
    required this.marketService,
    this.initialName = '',
    this.product,
  });

  final String houseId;
  final MarketService marketService;
  final String initialName;

  /// Quando presente, o sheet edita em vez de criar.
  final MarketProduct? product;

  @override
  State<ProductFormSheet> createState() => _ProductFormSheetState();
}

class _ProductFormSheetState extends State<ProductFormSheet> {
  late final TextEditingController _nameController;
  late final TextEditingController _priceController;
  String? _categoryId;
  String _unit = 'un';
  bool _isFixed = false;
  bool _saving = false;
  String _photoBase64 = '';

  bool get _isEditing => widget.product != null;

  @override
  void initState() {
    super.initState();
    final product = widget.product;
    _nameController = TextEditingController(
      text: product?.name ?? widget.initialName,
    );
    _priceController = TextEditingController(
      text: (product?.lastPrice ?? 0) > 0
          ? product!.lastPrice.toStringAsFixed(2).replaceAll('.', ',')
          : '',
    );
    if (product != null) {
      _categoryId = product.categoryId.isEmpty ? null : product.categoryId;
      _unit = product.unit;
      _isFixed = product.isFixed;
      _photoBase64 = product.photoBase64;
    }
  }

  Future<void> _pickPhoto() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            ListTile(
              leading: Icon(Icons.photo_camera_outlined),
              title: const Text('Tirar foto'),
              onTap: () => Navigator.of(context).pop(ImageSource.camera),
            ),
            ListTile(
              leading: Icon(Icons.photo_library_outlined),
              title: const Text('Escolher da galeria'),
              onTap: () => Navigator.of(context).pop(ImageSource.gallery),
            ),
            if (_photoBase64.isNotEmpty)
              ListTile(
                leading: Icon(Icons.delete_outline, color: Colors.red[400]),
                title: Text(
                  'Remover foto',
                  style: TextStyle(color: Colors.red[400]),
                ),
                onTap: () {
                  Navigator.of(context).pop();
                  setState(() => _photoBase64 = '');
                },
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );

    if (source == null) return;

    final picked = await ImagePicker().pickImage(
      source: source,
      maxWidth: 400,
      maxHeight: 400,
      imageQuality: 60,
    );
    if (picked == null) return;

    final bytes = await picked.readAsBytes();
    setState(() => _photoBase64 = base64Encode(bytes));
  }

  @override
  void dispose() {
    _nameController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  Future<void> _addNewCategory() async {
    final name = await showDialog<String>(
      context: context,
      builder: (dialogContext) {
        final colors = dialogContext.appColors;
        final controller = TextEditingController();
        return AlertDialog(
          title: const Text('Nova categoria'),
          content: TextField(
            controller: controller,
            autofocus: true,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(hintText: 'Ex: Congelados'),
            onSubmitted: (value) =>
                Navigator.of(dialogContext).pop(value.trim()),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: colors.primary,
              ),
              onPressed: () =>
                  Navigator.of(dialogContext).pop(controller.text.trim()),
              child: const Text('Criar'),
            ),
          ],
        );
      },
    );

    if (name == null || name.isEmpty) return;

    final id = await widget.marketService.addCategory(
      houseId: widget.houseId,
      name: name,
    );
    setState(() => _categoryId = id);
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    if (name.isEmpty || _categoryId == null || _saving) return;

    setState(() => _saving = true);

    final navigator = Navigator.of(context);
    final lastPrice = parsePrice(_priceController.text);

    if (_isEditing) {
      await widget.marketService.updateProduct(
        productId: widget.product!.id,
        name: name,
        categoryId: _categoryId!,
        unit: _unit,
        isFixed: _isFixed,
        lastPrice: lastPrice,
        photoBase64: _photoBase64,
      );
      navigator.pop(
        MarketProduct(
          id: widget.product!.id,
          houseId: widget.houseId,
          name: name,
          categoryId: _categoryId!,
          unit: _unit,
          isFixed: _isFixed,
          lastPrice: lastPrice,
          photoBase64: _photoBase64,
          createdAt: widget.product!.createdAt,
        ),
      );
      return;
    }

    final id = await widget.marketService.addProduct(
      houseId: widget.houseId,
      name: name,
      categoryId: _categoryId!,
      unit: _unit,
      isFixed: _isFixed,
      lastPrice: lastPrice,
      photoBase64: _photoBase64,
    );

    navigator.pop(
      MarketProduct(
        id: id,
        houseId: widget.houseId,
        name: name,
        categoryId: _categoryId!,
        unit: _unit,
        isFixed: _isFixed,
        lastPrice: lastPrice,
        photoBase64: _photoBase64,
        createdAt: DateTime.now(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
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
            Text(
              _isEditing ? 'Editar produto' : 'Cadastrar produto',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: colors.textPrimary,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                GestureDetector(
                  onTap: _pickPhoto,
                  child: Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: colors.surfaceMuted,
                      borderRadius: BorderRadius.circular(14),
                      image: _photoBase64.isNotEmpty
                          ? DecorationImage(
                              image: MemoryImage(base64Decode(_photoBase64)),
                              fit: BoxFit.cover,
                            )
                          : null,
                    ),
                    child: _photoBase64.isEmpty
                        ? Icon(
                            Icons.add_a_photo_outlined,
                            color: colors.textSecondary,
                            size: 24,
                          )
                        : null,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _nameController,
                    autofocus: !_isEditing,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: InputDecoration(
                      labelText: 'Nome do produto',
                      filled: true,
                      fillColor: colors.surfaceMuted,
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
            StreamBuilder<List<MarketCategory>>(
              stream: widget.marketService.categoriesStream(widget.houseId),
              builder: (context, snap) {
                final categories = snap.data ?? [];
                final validIds = categories.map((c) => c.id).toSet();
                final selected =
                    validIds.contains(_categoryId) ? _categoryId : null;

                return DropdownButtonFormField<String>(
                  initialValue: selected,
                  decoration: InputDecoration(
                    labelText: 'Categoria',
                    filled: true,
                    fillColor: colors.surfaceMuted,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                  ),
                  items: [
                    ...categories.map(
                      (category) => DropdownMenuItem(
                        value: category.id,
                        child: Row(
                          children: [
                            Icon(
                              AppIcons.fromCode(category.iconCode),
                              size: 18,
                              color: colors.textSecondary,
                            ),
                            const SizedBox(width: 8),
                            Text(category.name),
                          ],
                        ),
                      ),
                    ),
                    DropdownMenuItem(
                      value: '__new__',
                      child: Row(
                        children: [
                          Icon(Icons.add, size: 18, color: colors.primary),
                          SizedBox(width: 8),
                          Text('Nova categoria...'),
                        ],
                      ),
                    ),
                  ],
                  onChanged: (value) {
                    if (value == '__new__') {
                      _addNewCategory();
                    } else {
                      setState(() => _categoryId = value);
                    }
                  },
                );
              },
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _unit,
                    decoration: InputDecoration(
                      labelText: 'Unidade padrão',
                      filled: true,
                      fillColor: colors.surfaceMuted,
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
                      fillColor: colors.surfaceMuted,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: _isFixed,
              activeThumbColor: colors.primary,
              title: Text(
                'Produto fixo',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: colors.textPrimary,
                ),
              ),
              subtitle: const Text(
                'Compra recorrente (arroz, café...). Entra com um toque em "Adicionar fixos".',
                style: TextStyle(fontSize: 12.5),
              ),
              onChanged: (value) => setState(() => _isFixed = value),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: FilledButton(
                onPressed: _saving ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: colors.primary,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: Text(
                  _saving
                      ? 'Salvando...'
                      : _isEditing
                          ? 'Salvar'
                          : 'Cadastrar',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
