import 'package:flutter/material.dart';
import 'package:casoiko/theme/app_colors.dart';


import '../../models/finance_transaction.dart';
import '../../services/finance_service.dart';
import '../../utils/currency.dart';

/// Dados do lançamento preenchido no sheet.
class TransactionInput {
  const TransactionInput({
    required this.description,
    required this.amount,
    required this.category,
    required this.paidBy,
    required this.paidByName,
    required this.date,
    required this.splitAll,
  });

  final String description;
  final double amount;
  final String category;
  final String paidBy;
  final String paidByName;
  final DateTime date;

  /// Despesa dividida entre todos ou só de quem pagou.
  final bool splitAll;
}

class AddTransactionSheet extends StatefulWidget {
  const AddTransactionSheet({
    super.key,
    required this.type,
    required this.members,
    required this.currentUid,
  });

  /// [FinanceTransaction.typeIncome] ou [FinanceTransaction.typeExpense].
  final String type;
  final List<HouseMember> members;
  final String currentUid;

  @override
  State<AddTransactionSheet> createState() => _AddTransactionSheetState();
}

class _AddTransactionSheetState extends State<AddTransactionSheet> {
  final _descriptionController = TextEditingController();
  final _amountController = TextEditingController();

  late String _category;
  late String _paidBy;
  DateTime _date = DateTime.now();
  bool _splitAll = true;

  bool get _isIncome => widget.type == FinanceTransaction.typeIncome;

  List<FinanceCategory> get _categories =>
      _isIncome ? kIncomeCategories : kExpenseCategories;

  @override
  void initState() {
    super.initState();
    _category = _categories.first.name;
    _paidBy = widget.members.any((m) => m.uid == widget.currentUid)
        ? widget.currentUid
        : (widget.members.isNotEmpty ? widget.members.first.uid : '');
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2024),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) setState(() => _date = picked);
  }

  void _submit() {
    final description = _descriptionController.text.trim();
    final amount = parsePrice(_amountController.text);
    if (description.isEmpty || amount <= 0) return;

    final member = widget.members.firstWhere(
      (m) => m.uid == _paidBy,
      orElse: () => const HouseMember(uid: '', name: 'Alguém', photoUrl: ''),
    );

    Navigator.of(context).pop(
      TransactionInput(
        description: description,
        amount: amount,
        category: _category,
        paidBy: member.uid,
        paidByName: member.name,
        date: _date,
        splitAll: _isIncome || _splitAll,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final title = _isIncome ? 'Nova receita' : 'Nova despesa';
    final dateLabel =
        '${_date.day.toString().padLeft(2, '0')}/${_date.month.toString().padLeft(2, '0')}/${_date.year}';

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
                title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _descriptionController,
                autofocus: true,
                textCapitalization: TextCapitalization.sentences,
                decoration: _decoration(
                  _isIncome ? 'Ex: Salário Rafael' : 'Ex: Conserto da pia',
                ),
                onSubmitted: (_) => _submit(),
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
                      decoration: _decoration('0,00', label: 'Valor (R\$)'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: InkWell(
                      onTap: _pickDate,
                      borderRadius: BorderRadius.circular(12),
                      child: InputDecorator(
                        decoration: _decoration('', label: 'Data'),
                        child: Text(
                          dateLabel,
                          style: const TextStyle(fontSize: 15),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                initialValue: _category,
                decoration: _decoration('', label: 'Categoria'),
                items: _categories
                    .map(
                      (category) => DropdownMenuItem(
                        value: category.name,
                        child: Row(
                          children: [
                            Icon(
                              category.icon,
                              size: 18,
                              color: AppColors.textSecondary,
                            ),
                            const SizedBox(width: 8),
                            Text(category.name),
                          ],
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (value) => setState(
                  () => _category = value ?? _categories.first.name,
                ),
              ),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                initialValue: _paidBy.isEmpty ? null : _paidBy,
                decoration: _decoration(
                  '',
                  label: _isIncome ? 'Quem recebeu' : 'Quem pagou',
                ),
                items: widget.members
                    .map(
                      (member) => DropdownMenuItem(
                        value: member.uid,
                        child: Text(member.name),
                      ),
                    )
                    .toList(),
                onChanged: (value) =>
                    setState(() => _paidBy = value ?? _paidBy),
              ),
              if (!_isIncome) ...[
                const SizedBox(height: 14),
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.surfaceMuted,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  padding: const EdgeInsets.all(4),
                  child: Row(
                    children: [
                      Expanded(
                        child: _SplitOption(
                          label: 'Dividir entre todos',
                          icon: Icons.groups_outlined,
                          selected: _splitAll,
                          onTap: () => setState(() => _splitAll = true),
                        ),
                      ),
                      Expanded(
                        child: _SplitOption(
                          label: 'Só de quem pagou',
                          icon: Icons.person_outline,
                          selected: !_splitAll,
                          onTap: () => setState(() => _splitAll = false),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton(
                  onPressed: _submit,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text(
                    'Salvar',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
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
      fillColor: AppColors.surfaceMuted,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      ),
    );
  }
}

class _SplitOption extends StatelessWidget {
  const _SplitOption({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: selected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: selected
              ? Border.all(color: AppColors.primary, width: 1.5)
              : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 18,
              color:
                  selected ? AppColors.primary : AppColors.textSecondary,
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight:
                      selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected
                      ? AppColors.primary
                      : AppColors.textSecondary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
