import 'package:flutter/material.dart';
import 'package:casoiko/theme/app_colors.dart';


import '../../models/bill.dart';
import '../../models/finance_transaction.dart';
import '../../services/auth_service.dart';
import '../../services/finance_service.dart';
import '../../services/house_service.dart';
import '../../utils/currency.dart';
import 'add_transaction_sheet.dart';
import 'bill_form_sheet.dart';

const _monthNames = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

class ContasScreen extends StatefulWidget {
  const ContasScreen({super.key, required this.authService});

  final AuthService authService;

  @override
  State<ContasScreen> createState() => _ContasScreenState();
}

class _ContasScreenState extends State<ContasScreen> {
  final _houseService = HouseService();
  final _financeService = FinanceService();

  late final Future<String> _houseIdFuture;
  DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);

  String get _monthKey => FinanceTransaction.monthKeyFor(_month);

  bool get _isCurrentMonth {
    final now = DateTime.now();
    return _month.year == now.year && _month.month == now.month;
  }

  @override
  void initState() {
    super.initState();
    final user = widget.authService.currentUser;
    _houseIdFuture = user != null
        ? _houseService.ensureUserRegistered(user)
        : Future.value(HouseService.defaultHouseId);
  }

  void _changeMonth(int delta) {
    setState(() {
      _month = DateTime(_month.year, _month.month + delta);
    });
  }

  // ---------------------------------------------------------------------
  // Ações
  // ---------------------------------------------------------------------

  Future<void> _openAddMenu(String houseId, List<HouseMember> members) async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: context.appColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetContext) {
        final colors = sheetContext.appColors;
        return SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            ListTile(
              leading: Icon(Icons.arrow_downward, color: Colors.green),
              title: const Text('Receita'),
              subtitle: const Text('Salário, dinheiro que entra'),
              onTap: () => Navigator.of(sheetContext).pop('income'),
            ),
            ListTile(
              leading: Icon(Icons.arrow_upward, color: Colors.red),
              title: const Text('Despesa'),
              subtitle: const Text('Gasto avulso da casa'),
              onTap: () => Navigator.of(sheetContext).pop('expense'),
            ),
            ListTile(
              leading: Icon(
                Icons.receipt_long_outlined,
                color: colors.primary,
              ),
              title: const Text('Conta fixa'),
              subtitle: const Text('Luz, internet, aluguel...'),
              onTap: () => Navigator.of(sheetContext).pop('bill'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      );
      },
    );

    if (choice == null || !mounted) return;

    if (choice == 'bill') {
      await _openBillForm(houseId);
    } else {
      await _openTransactionForm(
        houseId,
        members,
        choice == 'income'
            ? FinanceTransaction.typeIncome
            : FinanceTransaction.typeExpense,
      );
    }
  }

  Future<void> _openBillForm(String houseId, {Bill? bill}) async {
    final result = await showModalBottomSheet<BillInput>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => BillFormSheet(bill: bill),
    );
    if (result == null) return;

    if (bill != null) {
      await _financeService.updateBill(
        billId: bill.id,
        name: result.name,
        amount: result.amount,
        dueDay: result.dueDay,
        category: result.category,
      );
    } else {
      await _financeService.addBill(
        houseId: houseId,
        name: result.name,
        amount: result.amount,
        dueDay: result.dueDay,
        category: result.category,
      );
    }
  }

  Future<void> _openTransactionForm(
    String houseId,
    List<HouseMember> members,
    String type,
  ) async {
    final result = await showModalBottomSheet<TransactionInput>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => AddTransactionSheet(
        type: type,
        members: members,
        currentUid: widget.authService.currentUser?.uid ?? '',
      ),
    );
    if (result == null) return;

    await _financeService.addTransaction(
      houseId: houseId,
      type: type,
      description: result.description,
      amount: result.amount,
      date: result.date,
      category: result.category,
      paidBy: result.paidBy,
      paidByName: result.paidByName,
    );
  }

  Future<void> _payBill(
    String houseId,
    Bill bill,
    List<HouseMember> members,
  ) async {
    final result = await showDialog<(double, HouseMember)>(
      context: context,
      builder: (_) => _PayBillDialog(
        bill: bill,
        members: members,
        currentUid: widget.authService.currentUser?.uid ?? '',
      ),
    );
    if (result == null) return;

    final (amount, member) = result;
    final now = DateTime.now();
    // Pagamento registrado no mês que está sendo visualizado.
    final date = _isCurrentMonth
        ? now
        : DateTime(_month.year, _month.month, bill.dueDay.clamp(1, 28));

    await _financeService.addTransaction(
      houseId: houseId,
      type: FinanceTransaction.typeExpense,
      description: bill.name,
      amount: amount,
      date: date,
      category: bill.category,
      paidBy: member.uid,
      paidByName: member.name,
      billId: bill.id,
    );
  }

  Future<void> _confirmDeleteBill(Bill bill) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Apagar "${bill.name}"?'),
        content: const Text(
          'A conta fixa some da lista de todos os meses. '
          'Pagamentos já registrados não são apagados.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red[400]),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Apagar'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await _financeService.deleteBill(bill.id);
    }
  }

  // ---------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<String>(
      future: _houseIdFuture,
      builder: (context, houseSnap) {
        if (houseSnap.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final houseId = houseSnap.data ?? HouseService.defaultHouseId;

        return StreamBuilder<List<HouseMember>>(
          stream: _financeService.membersStream(houseId),
          builder: (context, membersSnap) {
            final members = membersSnap.data ?? [];

            return StreamBuilder<List<Bill>>(
              stream: _financeService.billsStream(houseId),
              builder: (context, billsSnap) {
                final bills = billsSnap.data ?? [];

                return StreamBuilder<List<FinanceTransaction>>(
                  stream:
                      _financeService.transactionsStream(houseId, _monthKey),
                  builder: (context, txSnap) {
                    final transactions = txSnap.data ?? [];
                    final loading = txSnap.connectionState ==
                            ConnectionState.waiting &&
                        !txSnap.hasData;

                    return Scaffold(
                      appBar: AppBar(
                        title: const Text('Contas'),
                      ),
                      body: loading
                          ? const Center(child: CircularProgressIndicator())
                          : _buildBody(
                              houseId,
                              members,
                              bills,
                              transactions,
                            ),
                      floatingActionButton: FloatingActionButton(
                        onPressed: () => _openAddMenu(houseId, members),
                        tooltip: 'Adicionar',
                        child: Icon(Icons.add),
                      ),
                    );
                  },
                );
              },
            );
          },
        );
      },
    );
  }

  Widget _buildBody(
    String houseId,
    List<HouseMember> members,
    List<Bill> bills,
    List<FinanceTransaction> transactions,
  ) {
    final income = transactions
        .where((t) => t.isIncome)
        .fold<double>(0, (sum, t) => sum + t.amount);
    final expenses = transactions
        .where((t) => !t.isIncome)
        .fold<double>(0, (sum, t) => sum + t.amount);

    final paidBillIds =
        transactions.where((t) => t.billId.isNotEmpty).map((t) => t.billId).toSet();

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      children: [
        _MonthSelector(
          label: '${_monthNames[_month.month - 1]} ${_month.year}',
          onPrevious: () => _changeMonth(-1),
          onNext: () => _changeMonth(1),
        ),
        const SizedBox(height: 12),
        _SummaryCard(income: income, expenses: expenses),
        if (members.length > 1 && expenses > 0) ...[
          const SizedBox(height: 12),
          _SplitCard(
            members: members,
            transactions: transactions,
            expenses: expenses,
          ),
        ],
        const SizedBox(height: 16),
        _SectionHeader(label: 'Contas fixas (${bills.length})'),
        if (bills.isEmpty)
          const _HintCard(
            icon: Icons.receipt_long_outlined,
            text:
                'Nenhuma conta fixa ainda. Toque no + e cadastre luz, internet, aluguel...',
          )
        else
          ...bills.map((bill) {
            final paid = paidBillIds.contains(bill.id);
            return _BillTile(
              key: ValueKey(bill.id),
              bill: bill,
              paid: paid,
              isCurrentMonth: _isCurrentMonth,
              onPay: paid ? null : () => _payBill(houseId, bill, members),
              onEdit: () => _openBillForm(houseId, bill: bill),
              onDelete: () => _confirmDeleteBill(bill),
            );
          }),
        const SizedBox(height: 16),
        _SectionHeader(label: 'Lançamentos (${transactions.length})'),
        if (transactions.isEmpty)
          const _HintCard(
            icon: Icons.swap_vert,
            text: 'Nenhum lançamento neste mês.',
          )
        else
          ...transactions.map(
            (tx) => _TransactionTile(
              key: ValueKey(tx.id),
              transaction: tx,
              onDelete: () => _financeService.deleteTransaction(tx.id),
            ),
          ),
        const SizedBox(height: 80),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Widgets internos
// ---------------------------------------------------------------------------

class _MonthSelector extends StatelessWidget {
  const _MonthSelector({
    required this.label,
    required this.onPrevious,
    required this.onNext,
  });

  final String label;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        IconButton(
          onPressed: onPrevious,
          icon: Icon(Icons.chevron_left, color: colors.primary),
        ),
        SizedBox(
          width: 170,
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: colors.textPrimary,
            ),
          ),
        ),
        IconButton(
          onPressed: onNext,
          icon: Icon(Icons.chevron_right, color: colors.primary),
        ),
      ],
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.income, required this.expenses});

  final double income;
  final double expenses;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final balance = income - expenses;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.primary,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Expanded(
            child: _SummaryColumn(
              label: 'RECEITAS',
              value: formatPrice(income),
              color: const Color(0xFF9CCFA9),
            ),
          ),
          Expanded(
            child: _SummaryColumn(
              label: 'DESPESAS',
              value: formatPrice(expenses),
              color: const Color(0xFFE8A29A),
            ),
          ),
          Expanded(
            child: _SummaryColumn(
              label: 'SALDO',
              value: formatPrice(balance),
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryColumn extends StatelessWidget {
  const _SummaryColumn({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.8,
            color: Colors.white.withValues(alpha: 0.7),
          ),
        ),
        const SizedBox(height: 4),
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            value,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
        ),
      ],
    );
  }
}

/// Divisão igual entre os membros: cada um deve `despesas / N`.
/// Saldo = o que pagou menos a cota.
class _SplitCard extends StatelessWidget {
  const _SplitCard({
    required this.members,
    required this.transactions,
    required this.expenses,
  });

  final List<HouseMember> members;
  final List<FinanceTransaction> transactions;
  final double expenses;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final share = expenses / members.length;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'DIVISÃO DA CASA · ${formatPrice(share)} cada',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
              color: colors.textSecondary,
            ),
          ),
          const SizedBox(height: 12),
          ...members.map((member) {
            final paid = transactions
                .where((t) => !t.isIncome && t.paidBy == member.uid)
                .fold<double>(0, (sum, t) => sum + t.amount);
            final balance = paid - share;

            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 16,
                    backgroundColor:
                        colors.primary.withValues(alpha: 0.15),
                    backgroundImage: member.photoUrl.isNotEmpty
                        ? NetworkImage(member.photoUrl)
                        : null,
                    child: member.photoUrl.isEmpty
                        ? Text(
                            member.firstName.isNotEmpty
                                ? member.firstName[0]
                                : '?',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: colors.primary,
                            ),
                          )
                        : null,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          member.firstName,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: colors.textPrimary,
                          ),
                        ),
                        Text(
                          'pagou ${formatPrice(paid)}',
                          style: TextStyle(
                            fontSize: 12,
                            color:
                                colors.textSecondary.withValues(alpha: 0.7),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    balance >= 0
                        ? '+${formatPrice(balance)}'
                        : formatPrice(balance),
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: balance >= 0
                          ? const Color(0xFF2E7D4F)
                          : const Color(0xFFC0392B),
                    ),
                  ),
                ],
              ),
            );
          }),
          Text(
            'Positivo = pagou mais que a cota e tem a receber.',
            style: TextStyle(
              fontSize: 11,
              color: colors.textSecondary.withValues(alpha: 0.6),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.only(left: 4, top: 4, bottom: 8),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.8,
          color: colors.textSecondary,
        ),
      ),
    );
  }
}

class _HintCard extends StatelessWidget {
  const _HintCard({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Icon(icon, color: colors.textSecondary, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 13,
                color: colors.textSecondary,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BillTile extends StatelessWidget {
  const _BillTile({
    super.key,
    required this.bill,
    required this.paid,
    required this.isCurrentMonth,
    required this.onPay,
    required this.onEdit,
    required this.onDelete,
  });

  final Bill bill;
  final bool paid;
  final bool isCurrentMonth;
  final VoidCallback? onPay;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final today = DateTime.now().day;
    final overdue = !paid && isCurrentMonth && today > bill.dueDay;
    final dueSoon = !paid &&
        isCurrentMonth &&
        !overdue &&
        bill.dueDay - today <= 3;

    return Dismissible(
      key: ValueKey(bill.id),
      direction: DismissDirection.endToStart,
      confirmDismiss: (_) async {
        onDelete();
        return false;
      },
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
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: paid ? Colors.white.withValues(alpha: 0.55) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: overdue
              ? Border.all(color: const Color(0xFFC0392B), width: 1)
              : null,
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
          onTap: onEdit,
          leading: CircleAvatar(
            backgroundColor: colors.primary.withValues(alpha: 0.1),
            child: Icon(
              financeIconFor(bill.category),
              size: 20,
              color: colors.primary,
            ),
          ),
          title: Text(
            bill.name,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w500,
              color: paid
                  ? colors.textSecondary.withValues(alpha: 0.55)
                  : colors.textPrimary,
              decoration: paid ? TextDecoration.lineThrough : null,
            ),
          ),
          subtitle: Text(
            overdue
                ? 'Venceu dia ${bill.dueDay}!'
                : 'Vence dia ${bill.dueDay} · ${formatPrice(bill.amount)}',
            style: TextStyle(
              fontSize: 12,
              fontWeight: overdue ? FontWeight.w700 : FontWeight.w400,
              color: overdue
                  ? const Color(0xFFC0392B)
                  : dueSoon
                      ? const Color(0xFFB8860B)
                      : colors.textSecondary.withValues(alpha: 0.65),
            ),
          ),
          trailing: paid
              ? Icon(Icons.check_circle, color: Color(0xFF2E7D4F))
              : FilledButton(
                  onPressed: onPay,
                  style: FilledButton.styleFrom(
                    backgroundColor: colors.primary,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    visualDensity: VisualDensity.compact,
                  ),
                  child: const Text('Pagar'),
                ),
        ),
      ),
    );
  }
}

class _TransactionTile extends StatelessWidget {
  const _TransactionTile({
    super.key,
    required this.transaction,
    required this.onDelete,
  });

  final FinanceTransaction transaction;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final tx = transaction;
    final dateLabel =
        '${tx.date.day.toString().padLeft(2, '0')}/${tx.date.month.toString().padLeft(2, '0')}';

    return Dismissible(
      key: ValueKey(tx.id),
      direction: DismissDirection.endToStart,
      onDismissed: (_) => onDelete(),
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
              const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
          leading: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: tx.isIncome
                  ? const Color(0xFF2E7D4F).withValues(alpha: 0.12)
                  : const Color(0xFFC0392B).withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              tx.isIncome ? Icons.arrow_downward : Icons.arrow_upward,
              size: 18,
              color: tx.isIncome
                  ? const Color(0xFF2E7D4F)
                  : const Color(0xFFC0392B),
            ),
          ),
          title: Text(
            tx.description,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w500,
              color: colors.textPrimary,
            ),
          ),
          subtitle: Text(
            '$dateLabel · ${financeCategoryName(tx.category)} · ${tx.paidByName.split(' ').first}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 12,
              color: colors.textSecondary.withValues(alpha: 0.65),
            ),
          ),
          trailing: Text(
            '${tx.isIncome ? '+' : '-'}${formatPrice(tx.amount)}',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: tx.isIncome
                  ? const Color(0xFF2E7D4F)
                  : const Color(0xFFC0392B),
            ),
          ),
        ),
      ),
    );
  }
}

class _PayBillDialog extends StatefulWidget {
  const _PayBillDialog({
    required this.bill,
    required this.members,
    required this.currentUid,
  });

  final Bill bill;
  final List<HouseMember> members;
  final String currentUid;

  @override
  State<_PayBillDialog> createState() => _PayBillDialogState();
}

class _PayBillDialogState extends State<_PayBillDialog> {
  late final TextEditingController _amountController;
  late String _paidBy;

  @override
  void initState() {
    super.initState();
    _amountController = TextEditingController(
      text: widget.bill.amount.toStringAsFixed(2).replaceAll('.', ','),
    );
    _paidBy = widget.members.any((m) => m.uid == widget.currentUid)
        ? widget.currentUid
        : (widget.members.isNotEmpty ? widget.members.first.uid : '');
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  void _submit() {
    final amount = parsePrice(_amountController.text);
    if (amount <= 0) return;

    final member = widget.members.firstWhere(
      (m) => m.uid == _paidBy,
      orElse: () => const HouseMember(uid: '', name: 'Alguém', photoUrl: ''),
    );
    Navigator.of(context).pop((amount, member));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return AlertDialog(
      title: Text('Pagar ${widget.bill.name}'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _amountController,
            autofocus: true,
            keyboardType:
                const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
              labelText: 'Valor pago (R\$)',
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _paidBy.isEmpty ? null : _paidBy,
            decoration: const InputDecoration(labelText: 'Quem pagou'),
            items: widget.members
                .map(
                  (member) => DropdownMenuItem(
                    value: member.uid,
                    child: Text(member.name),
                  ),
                )
                .toList(),
            onChanged: (value) => setState(() => _paidBy = value ?? _paidBy),
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
            backgroundColor: colors.primary,
          ),
          onPressed: _submit,
          child: const Text('Confirmar'),
        ),
      ],
    );
  }
}
