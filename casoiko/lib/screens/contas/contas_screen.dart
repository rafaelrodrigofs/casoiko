import 'package:flutter/material.dart';
import 'package:casoiko/theme/app_colors.dart';


import '../../models/bill.dart';
import '../../models/finance_transaction.dart';
import '../../services/auth_service.dart';
import '../../services/finance_service.dart';
import '../../services/house_service.dart';
import '../../utils/currency.dart';
import '../../widgets/floating_bottom_nav.dart';
import '../../widgets/shell_tab_bar.dart';
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
              leading: const Icon(Icons.arrow_downward, color: Colors.green),
              title: const Text('Receita'),
              subtitle: const Text('Salário, dinheiro que entra'),
              onTap: () => Navigator.of(context).pop('income'),
            ),
            ListTile(
              leading: const Icon(Icons.arrow_upward, color: Colors.red),
              title: const Text('Despesa'),
              subtitle: const Text('Gasto avulso da casa'),
              onTap: () => Navigator.of(context).pop('expense'),
            ),
            ListTile(
              leading: const Icon(
                Icons.receipt_long_outlined,
                color: AppColors.primary,
              ),
              title: const Text('Conta fixa'),
              subtitle: const Text('Luz, internet, aluguel...'),
              onTap: () => Navigator.of(context).pop('bill'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
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
      splitAll: result.splitAll,
    );
  }

  Future<void> _payBill(
    String houseId,
    Bill bill,
    List<HouseMember> members,
    Set<String> alreadyPaidUids, {
    String? preselectedUid,
  }) async {
    final result = await showDialog<(double, HouseMember)>(
      context: context,
      builder: (_) => _PayBillDialog(
        bill: bill,
        members: members,
        alreadyPaidUids: alreadyPaidUids,
        currentUid: widget.authService.currentUser?.uid ?? '',
        preselectedUid: preselectedUid,
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
      splitAll: false,
    );
  }

  Future<void> _undoBillPayment(FinanceTransaction payment) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Desfazer pagamento?'),
        content: Text(
          'Remove o registro de ${payment.paidByName.split(' ').first} '
          '(${formatPrice(payment.amount)}). A parte volta como pendente.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red[400]),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Desfazer'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await _financeService.deleteTransaction(payment.id);
    }
  }

  Future<void> _changeBillPayer(
    String houseId,
    Bill bill,
    FinanceTransaction payment,
    List<HouseMember> members,
    Set<String> paidUids,
  ) async {
    final candidates = members
        .where((m) => m.uid != payment.paidBy && !paidUids.contains(m.uid))
        .toList();
    if (candidates.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Todos os outros já pagaram a parte deles.'),
        ),
      );
      return;
    }

    final newMember = await showDialog<HouseMember>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('Alterar quem pagou'),
        children: candidates
            .map(
              (member) => SimpleDialogOption(
                onPressed: () => Navigator.of(context).pop(member),
                child: Text(member.name),
              ),
            )
            .toList(),
      ),
    );
    if (newMember == null) return;

    await _financeService.deleteTransaction(payment.id);
    await _financeService.addTransaction(
      houseId: houseId,
      type: FinanceTransaction.typeExpense,
      description: bill.name,
      amount: payment.amount,
      date: payment.date,
      category: bill.category,
      paidBy: newMember.uid,
      paidByName: newMember.name,
      billId: bill.id,
      splitAll: false,
    );
  }

  Future<void> _onMemberChipTap(
    String houseId,
    Bill bill,
    HouseMember member,
    FinanceTransaction? payment,
    List<HouseMember> members,
    Set<String> paidUids,
  ) async {
    if (payment != null) {
      final action = await showModalBottomSheet<String>(
        context: context,
        backgroundColor: Colors.white,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        builder: (context) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
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
                  bill.name,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '${member.name} pagou ${formatPrice(payment.amount)} '
                  'em ${payment.date.day.toString().padLeft(2, '0')}/'
                  '${payment.date.month.toString().padLeft(2, '0')}',
                  style: const TextStyle(
                    fontSize: 14,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 20),
                OutlinedButton.icon(
                  onPressed: () => Navigator.of(context).pop('change'),
                  icon: const Icon(Icons.swap_horiz, size: 20),
                  label: const Text('Alterar quem pagou'),
                ),
                const SizedBox(height: 8),
                FilledButton.icon(
                  onPressed: () => Navigator.of(context).pop('undo'),
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.red[400],
                  ),
                  icon: const Icon(Icons.undo, size: 20),
                  label: const Text('Desfazer pagamento'),
                ),
              ],
            ),
          ),
        ),
      );

      if (action == 'undo') {
        await _undoBillPayment(payment);
      } else if (action == 'change') {
        await _changeBillPayer(
          houseId,
          bill,
          payment,
          members,
          paidUids,
        );
      }
    } else {
      await _payBill(
        houseId,
        bill,
        members,
        paidUids,
        preselectedUid: member.uid,
      );
    }
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
                      body: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          ShellTabBar(
                            title: 'Contas',
                            icon: Icons.receipt_long_rounded,
                          ),
                          Expanded(
                            child: loading
                                ? const Center(
                                    child: CircularProgressIndicator(),
                                  )
                                : _buildBody(
                                    houseId,
                                    members,
                                    bills,
                                    transactions,
                                  ),
                          ),
                        ],
                      ),
                      floatingActionButtonLocation:
                          FloatingNavFabLocation.endFloat,
                      floatingActionButton: FloatingActionButton(
                        onPressed: () => _openAddMenu(houseId, members),
                        tooltip: 'Adicionar',
                        child: const Icon(Icons.add),
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

    // Pagamentos de conta fixa neste mês (billId → uid → lançamento).
    final paymentByBillAndMember = <String, Map<String, FinanceTransaction>>{};
    for (final tx in transactions) {
      if (tx.billId.isEmpty) continue;
      paymentByBillAndMember
          .putIfAbsent(tx.billId, () => {})
          .putIfAbsent(tx.paidBy, () => tx);
    }

    final paidUidsByBill = paymentByBillAndMember.map(
      (billId, byMember) => MapEntry(billId, byMember.keys.toSet()),
    );

    final currentUid = widget.authService.currentUser?.uid ?? '';

    return ListView(
      padding: EdgeInsets.fromLTRB(
        16,
        12,
        16,
        MediaQuery.paddingOf(context).bottom + 72,
      ),
      children: [
        _MonthSelector(
          label: '${_monthNames[_month.month - 1]} ${_month.year}',
          onPrevious: () => _changeMonth(-1),
          onNext: () => _changeMonth(1),
        ),
        const SizedBox(height: 12),
        _SummaryCard(income: income, expenses: expenses),
        if (members.length > 1 && (bills.isNotEmpty || expenses > 0)) ...[
          const SizedBox(height: 12),
          _SplitCard(
            members: members,
            bills: bills,
            transactions: transactions,
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
            final paymentsByMember =
                paymentByBillAndMember[bill.id] ?? const {};
            final paidUids = paidUidsByBill[bill.id] ?? const <String>{};
            final allPaid = members.isNotEmpty &&
                members.every((m) => paidUids.contains(m.uid));
            return _BillTile(
              key: ValueKey(bill.id),
              bill: bill,
              members: members,
              paymentsByMember: paymentsByMember,
              paidUids: paidUids,
              allPaid: allPaid,
              currentUserPaid: paidUids.contains(currentUid),
              isCurrentMonth: _isCurrentMonth,
              onPay: allPaid
                  ? null
                  : () => _payBill(houseId, bill, members, paidUids),
              onMemberTap: (member, payment) => _onMemberChipTap(
                houseId,
                bill,
                member,
                payment,
                members,
                paidUids,
              ),
              onEdit: () => _openBillForm(houseId, bill: bill),
              onDelete: () => _confirmDeleteBill(bill),
            );
          }),
        const SizedBox(height: 16),
        _SectionHeader(
          label: 'Lançamentos (${transactions.where((t) => t.billId.isEmpty).length})',
        ),
        if (transactions.where((t) => t.billId.isEmpty).isEmpty)
          const _HintCard(
            icon: Icons.swap_vert,
            text: 'Nenhum lançamento neste mês.',
          )
        else
          ...transactions.where((t) => t.billId.isEmpty).map(
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
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        IconButton(
          onPressed: onPrevious,
          icon: const Icon(Icons.chevron_left, color: AppColors.primary),
        ),
        SizedBox(
          width: 170,
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
        ),
        IconButton(
          onPressed: onNext,
          icon: const Icon(Icons.chevron_right, color: AppColors.primary),
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
    final balance = income - expenses;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primary,
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

/// Divisão igual entre os membros, calculada desde o cadastro das contas:
/// a parte de cada um = contas fixas do mês ÷ N + despesas avulsas
/// divididas ÷ N. Quem já pagou a própria parte fica "em dia".
class _SplitCard extends StatelessWidget {
  const _SplitCard({
    required this.members,
    required this.bills,
    required this.transactions,
  });

  final List<HouseMember> members;
  final List<Bill> bills;
  final List<FinanceTransaction> transactions;

  @override
  Widget build(BuildContext context) {
    final memberCount = members.length;

    // Despesas avulsas divididas entre todos.
    final sharedExpenses = transactions
        .where((t) => !t.isIncome && t.billId.isEmpty && t.splitAll)
        .toList();
    final sharedTotal =
        sharedExpenses.fold<double>(0, (sum, t) => sum + t.amount);
    final sharedShare = memberCount > 0 ? sharedTotal / memberCount : 0.0;

    // Parte estimada total (para o título do card).
    final billsTotal = bills.fold<double>(0, (sum, b) => sum + b.amount);
    final estimatedShare = memberCount > 0
        ? (billsTotal + sharedTotal) / memberCount
        : 0.0;

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
            'DIVISÃO DA CASA · ${formatPrice(estimatedShare)} cada',
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 12),
          ...members.map((member) {
            // Parte fixa: cada conta ÷ N + cada avulsa dividida ÷ N.
            // Não muda quando alguém paga — pagamento só afeta "pagou".
            var owed = sharedShare;
            for (final bill in bills) {
              owed += memberCount > 0 ? bill.amount / memberCount : 0;
            }

            // Pagamentos de conta fixa (só lançamentos com bill_id).
            var paid = 0.0;
            for (final tx in transactions) {
              if (tx.isIncome || tx.billId.isEmpty || tx.paidBy != member.uid) {
                continue;
              }
              paid += tx.amount;
            }
            // Avulsas divididas pagas por este membro.
            paid += sharedExpenses
                .where((t) => t.paidBy == member.uid)
                .fold<double>(0, (sum, t) => sum + t.amount);

            final diff = paid - owed;
            const tolerance = 0.01;

            final String statusText;
            final Color statusColor;
            if (diff > tolerance) {
              statusText = '+${formatPrice(diff)} a receber';
              statusColor = const Color(0xFF2E7D4F);
            } else if (diff < -tolerance) {
              statusText = 'falta ${formatPrice(-diff)}';
              statusColor = const Color(0xFFC0392B);
            } else {
              statusText = 'em dia';
              statusColor = const Color(0xFF2E7D4F);
            }

            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 16,
                    backgroundColor:
                        AppColors.primary.withValues(alpha: 0.15),
                    backgroundImage: member.photoUrl.isNotEmpty
                        ? NetworkImage(member.photoUrl)
                        : null,
                    child: member.photoUrl.isEmpty
                        ? Text(
                            member.firstName.isNotEmpty
                                ? member.firstName[0]
                                : '?',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
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
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        Text(
                          'parte ${formatPrice(owed)} · pagou ${formatPrice(paid)}',
                          style: TextStyle(
                            fontSize: 12,
                            color:
                                AppColors.textSecondary.withValues(alpha: 0.7),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    statusText,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: statusColor,
                    ),
                  ),
                ],
              ),
            );
          }),
          Text(
            '"A receber" = pagou despesa dividida sozinho e os outros devem a parte deles.',
            style: TextStyle(
              fontSize: 11,
              color: AppColors.textSecondary.withValues(alpha: 0.6),
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
    return Padding(
      padding: const EdgeInsets.only(left: 4, top: 4, bottom: 8),
      child: Text(
        label.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.8,
          color: AppColors.textSecondary,
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
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.textSecondary, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.textSecondary,
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
    required this.members,
    required this.paymentsByMember,
    required this.paidUids,
    required this.allPaid,
    required this.currentUserPaid,
    required this.isCurrentMonth,
    required this.onPay,
    required this.onMemberTap,
    required this.onEdit,
    required this.onDelete,
  });

  final Bill bill;
  final List<HouseMember> members;
  final Map<String, FinanceTransaction> paymentsByMember;
  final Set<String> paidUids;
  final bool allPaid;
  final bool currentUserPaid;
  final bool isCurrentMonth;
  final VoidCallback? onPay;
  final void Function(HouseMember member, FinanceTransaction? payment)
      onMemberTap;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now().day;
    final overdue = !allPaid && isCurrentMonth && today > bill.dueDay;
    final dueSoon = !allPaid &&
        isCurrentMonth &&
        !overdue &&
        bill.dueDay - today <= 3;

    final share =
        members.isNotEmpty ? bill.amount / members.length : bill.amount;

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
        child: const Icon(Icons.delete_outline, color: Colors.white, size: 22),
      ),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: allPaid ? Colors.white.withValues(alpha: 0.55) : Colors.white,
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
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onEdit,
        child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      backgroundColor:
                          AppColors.primary.withValues(alpha: 0.1),
                      child: Icon(
                        financeIconFor(bill.category),
                        size: 20,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
          child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            bill.name,
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w500,
                              color: allPaid
                                  ? AppColors.textSecondary
                                      .withValues(alpha: 0.55)
                                  : AppColors.textPrimary,
                              decoration: allPaid
                                  ? TextDecoration.lineThrough
                                  : null,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            overdue
                                ? 'Venceu dia ${bill.dueDay}! · ${formatPrice(share)} cada'
                                : 'Vence dia ${bill.dueDay} · ${formatPrice(bill.amount)} · ${formatPrice(share)} cada',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: overdue
                                  ? FontWeight.w700
                                  : FontWeight.w400,
                              color: overdue
                                  ? const Color(0xFFC0392B)
                                  : dueSoon
                                      ? const Color(0xFFB8860B)
                                      : AppColors.textSecondary
                                          .withValues(alpha: 0.65),
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (allPaid)
                      const Icon(Icons.check_circle, color: Color(0xFF2E7D4F))
                    else if (!currentUserPaid)
                      FilledButton(
                        onPressed: onPay,
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          padding:
                              const EdgeInsets.symmetric(horizontal: 16),
                          visualDensity: VisualDensity.compact,
                        ),
                        child: const Text('Pagar'),
                      )
                    else
                      TextButton(
                        onPressed: onPay,
                        style: TextButton.styleFrom(
                          padding:
                              const EdgeInsets.symmetric(horizontal: 8),
                          visualDensity: VisualDensity.compact,
                        ),
                        child: const Text(
                          'Pagar por outro',
                          style: TextStyle(fontSize: 12),
                        ),
                      ),
                  ],
                ),
                if (members.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const SizedBox(width: 52),
                      Expanded(
                        child: Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          children: members.map((member) {
                            final memberPaid =
                                paidUids.contains(member.uid);
                            final payment = paymentsByMember[member.uid];
                            return _MemberPayChip(
                              name: member.firstName,
                              paid: memberPaid,
                              onTap: () => onMemberTap(member, payment),
                            );
                          }).toList(),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MemberPayChip extends StatelessWidget {
  const _MemberPayChip({
    required this.name,
    required this.paid,
    required this.onTap,
  });

  final String name;
  final bool paid;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    const paidColor = Color(0xFF2E7D4F);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: paid
                ? paidColor.withValues(alpha: 0.10)
                : AppColors.surfaceMuted,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                paid ? Icons.check_circle : Icons.schedule,
                size: 13,
                color: paid
                    ? paidColor
                    : AppColors.textSecondary.withValues(alpha: 0.6),
              ),
              const SizedBox(width: 4),
              Text(
                name,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: paid
                      ? paidColor
                      : AppColors.textSecondary.withValues(alpha: 0.8),
                ),
              ),
            ],
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
        child: const Icon(Icons.delete_outline, color: Colors.white, size: 22),
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
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w500,
              color: AppColors.textPrimary,
            ),
          ),
          subtitle: Text(
            '$dateLabel · ${financeCategoryName(tx.category)} · ${tx.paidByName.split(' ').first}'
            '${!tx.isIncome && !tx.splitAll ? ' · só de quem pagou' : ''}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary.withValues(alpha: 0.65),
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
    required this.alreadyPaidUids,
    required this.currentUid,
    this.preselectedUid,
  });

  final Bill bill;
  final List<HouseMember> members;
  final Set<String> alreadyPaidUids;
  final String currentUid;
  final String? preselectedUid;

  @override
  State<_PayBillDialog> createState() => _PayBillDialogState();
}

class _PayBillDialogState extends State<_PayBillDialog> {
  late final TextEditingController _amountController;
  late String _paidBy;

  List<HouseMember> get _pendingMembers => widget.members
      .where((m) => !widget.alreadyPaidUids.contains(m.uid))
      .toList();

  @override
  void initState() {
    super.initState();
    final share = widget.members.isNotEmpty
        ? widget.bill.amount / widget.members.length
        : widget.bill.amount;
    _amountController = TextEditingController(
      text: share.toStringAsFixed(2).replaceAll('.', ','),
    );
    final pending = _pendingMembers;
    if (widget.preselectedUid != null &&
        pending.any((m) => m.uid == widget.preselectedUid)) {
      _paidBy = widget.preselectedUid!;
    } else {
      _paidBy = pending.any((m) => m.uid == widget.currentUid)
          ? widget.currentUid
          : (pending.isNotEmpty ? pending.first.uid : '');
    }
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  void _submit() {
    final amount = parsePrice(_amountController.text);
    if (amount <= 0 || _paidBy.isEmpty) return;

    final member = widget.members.firstWhere(
      (m) => m.uid == _paidBy,
      orElse: () => const HouseMember(uid: '', name: 'Alguém', photoUrl: ''),
    );
    Navigator.of(context).pop((amount, member));
  }

  @override
  Widget build(BuildContext context) {
    final pending = _pendingMembers;

    return AlertDialog(
      title: Text('Pagar ${widget.bill.name}'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Parte de cada um: ${formatPrice(widget.members.isNotEmpty ? widget.bill.amount / widget.members.length : widget.bill.amount)}',
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.textSecondary,
              ),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _amountController,
            autofocus: true,
            keyboardType:
                const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
              labelText: 'Valor da parte (R\$)',
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _paidBy.isEmpty ? null : _paidBy,
            decoration: const InputDecoration(labelText: 'Quem está pagando'),
            items: pending
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
            backgroundColor: AppColors.primary,
          ),
          onPressed: _submit,
          child: const Text('Confirmar'),
        ),
      ],
    );
  }
}
