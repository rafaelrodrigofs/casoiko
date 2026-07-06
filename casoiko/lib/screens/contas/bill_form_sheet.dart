import 'package:flutter/material.dart';

import '../../models/bill.dart';
import '../../services/finance_service.dart';
import '../../utils/currency.dart';

/// Dados da conta fixa preenchida no sheet.
class BillInput {
  const BillInput({
    required this.name,
    required this.amount,
    required this.dueDay,
    required this.category,
  });

  final String name;
  final double amount;
  final int dueDay;
  final String category;
}

/// Cria ou edita uma conta fixa.
class BillFormSheet extends StatefulWidget {
  const BillFormSheet({super.key, this.bill});

  /// Quando presente, edita em vez de criar.
  final Bill? bill;

  @override
  State<BillFormSheet> createState() => _BillFormSheetState();
}

class _BillFormSheetState extends State<BillFormSheet> {
  late final TextEditingController _nameController;
  late final TextEditingController _amountController;
  late int _dueDay;
  late String _category;

  bool get _isEditing => widget.bill != null;

  @override
  void initState() {
    super.initState();
    final bill = widget.bill;
    _nameController = TextEditingController(text: bill?.name ?? '');
    _amountController = TextEditingController(
      text: (bill?.amount ?? 0) > 0
          ? bill!.amount.toStringAsFixed(2).replaceAll('.', ',')
          : '',
    );
    _dueDay = bill?.dueDay ?? 10;
    _category = bill?.category ?? kExpenseCategories.first;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  void _submit() {
    final name = _nameController.text.trim();
    final amount = parsePrice(_amountController.text);
    if (name.isEmpty || amount <= 0) return;

    Navigator.of(context).pop(
      BillInput(
        name: name,
        amount: amount,
        dueDay: _dueDay,
        category: _category,
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
        child: SingleChildScrollView(
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
                _isEditing ? 'Editar conta fixa' : 'Nova conta fixa',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF2F3A2E),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _nameController,
                autofocus: !_isEditing,
                textCapitalization: TextCapitalization.sentences,
                decoration: _decoration('Ex: Luz, Internet, Aluguel...'),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _amountController,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration:
                          _decoration('0,00', label: 'Valor previsto (R\$)'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: DropdownButtonFormField<int>(
                      initialValue: _dueDay,
                      decoration: _decoration('', label: 'Vence dia'),
                      items: List.generate(31, (i) => i + 1)
                          .map(
                            (day) => DropdownMenuItem(
                              value: day,
                              child: Text('$day'),
                            ),
                          )
                          .toList(),
                      onChanged: (value) =>
                          setState(() => _dueDay = value ?? 10),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                initialValue: _category,
                decoration: _decoration('', label: 'Categoria'),
                items: kExpenseCategories
                    .map(
                      (category) => DropdownMenuItem(
                        value: category,
                        child: Text(category),
                      ),
                    )
                    .toList(),
                onChanged: (value) => setState(
                  () => _category = value ?? kExpenseCategories.first,
                ),
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
                  child: Text(
                    _isEditing ? 'Salvar' : 'Criar',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _decoration(String hint, {String? label}) {
    return InputDecoration(
      hintText: hint.isEmpty ? null : hint,
      labelText: label,
      filled: true,
      fillColor: const Color(0xFFF5F0E8),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFF3D5A4C), width: 1.5),
      ),
    );
  }
}
