import 'package:flutter/material.dart';
import 'package:natipsico/theme/app_colors.dart';

import '../../models/patient.dart';
import '../../models/payment.dart';
import '../../services/auth_service.dart';
import '../../services/patient_service.dart';
import '../../services/payment_service.dart';
import '../../utils/format.dart';
import '../../widgets/ui_bits.dart';

class FinanceiroScreen extends StatefulWidget {
  const FinanceiroScreen({super.key, required this.authService});

  final AuthService authService;

  @override
  State<FinanceiroScreen> createState() => _FinanceiroScreenState();
}

class _FinanceiroScreenState extends State<FinanceiroScreen> {
  late DateTime _month;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = DateTime(now.year, now.month);
  }

  @override
  Widget build(BuildContext context) {
    final uid = widget.authService.uid;
    if (uid == null) return const SizedBox.shrink();
    final service = PaymentService(uid);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 16, 8),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Financeiro',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: _month,
                        firstDate: DateTime(2024),
                        lastDate: DateTime(2100),
                        helpText: 'Escolha o mês',
                      );
                      if (picked != null) {
                        setState(
                          () => _month = DateTime(picked.year, picked.month),
                        );
                      }
                    },
                    child: Text(
                      '${monthYear.format(_month)} ˅',
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => _addPayment(context, uid),
                    icon: const Icon(
                      Icons.add_circle,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(24, 8, 24, 120),
                children: [
                  FutureBuilder<PaymentSummary>(
                    future: service.summaryForMonth(_month),
                    builder: (context, snap) {
                      final s =
                          snap.data ??
                          const PaymentSummary(
                            received: 0,
                            pending: 0,
                            receivedCount: 0,
                            pendingCount: 0,
                          );
                      return Column(
                        children: [
                          SoftCard(
                            color: AppColors.primarySoft,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Receita confirmada',
                                  style: TextStyle(
                                    color: AppColors.textSecondary,
                                    fontSize: 13,
                                  ),
                                ),
                                Text(
                                  currencyBrl.format(s.received),
                                  style: const TextStyle(
                                    fontSize: 32,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                Text(
                                  'Total do mês: ${currencyBrl.format(s.total)}',
                                  style: const TextStyle(
                                    color: AppColors.primaryDark,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: SoftCard(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'Recebido',
                                        style: TextStyle(
                                          color: AppColors.textSecondary,
                                          fontSize: 12,
                                        ),
                                      ),
                                      Text(
                                        currencyBrl.format(s.received),
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 18,
                                          color: AppColors.primary,
                                        ),
                                      ),
                                      Text(
                                        '${s.receivedCount} pagamentos',
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: AppColors.textMuted,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: SoftCard(
                                  color: AppColors.warningSoft,
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'Pendente',
                                        style: TextStyle(
                                          color: AppColors.textSecondary,
                                          fontSize: 12,
                                        ),
                                      ),
                                      Text(
                                        currencyBrl.format(s.pending),
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 18,
                                          color: AppColors.warning,
                                        ),
                                      ),
                                      Text(
                                        '${s.pendingCount} pagamentos',
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: AppColors.textMuted,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 20),
                  const SectionTitle('Movimentações recentes'),
                  const SizedBox(height: 8),
                  StreamBuilder<List<Payment>>(
                    stream: service.watchMonth(_month),
                    builder: (context, snap) {
                      final list = snap.data ?? [];
                      if (list.isEmpty) {
                        return const SoftCard(
                          child: Text(
                            'Nenhuma movimentação neste mês.',
                            style: TextStyle(color: AppColors.textSecondary),
                          ),
                        );
                      }
                      return Column(
                        children: list.map((p) {
                          final received = p.status == PaymentStatus.received;
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: SoftCard(
                              onTap: received
                                  ? null
                                  : () async {
                                      await service.markReceived(p.id);
                                      setState(() {});
                                    },
                              child: Row(
                                children: [
                                  Container(
                                    width: 36,
                                    height: 36,
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      color: received
                                          ? AppColors.primarySoft
                                          : AppColors.warningSoft,
                                      borderRadius: BorderRadius.circular(18),
                                    ),
                                    child: Text(
                                      received ? '↙' : '•',
                                      style: TextStyle(
                                        color: received
                                            ? AppColors.primary
                                            : AppColors.warning,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          p.patientName,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        Text(
                                          '${dateShort.format(p.date)} • ${p.description.isEmpty ? (received ? 'Recebido' : 'Aguardando') : p.description}',
                                          style: const TextStyle(
                                            fontSize: 12,
                                            color: AppColors.textSecondary,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Text(
                                    '${received ? '+ ' : ''}${currencyBrl.format(p.amount)}',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      color: received
                                          ? AppColors.primary
                                          : AppColors.textPrimary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        }).toList(),
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _addPayment(BuildContext context, String uid) async {
    final patients = await PatientService(
      uid,
    ).watchAll(status: PatientStatus.active).first;
    if (!context.mounted) return;
    if (patients.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cadastre um paciente primeiro.')),
      );
      return;
    }

    Patient? selected = patients.first;
    final amountCtrl = TextEditingController(text: '220');
    var status = PaymentStatus.received;
    final descCtrl = TextEditingController(text: 'Sessão');

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModal) {
            return Padding(
              padding: EdgeInsets.fromLTRB(
                24,
                20,
                24,
                24 + MediaQuery.viewInsetsOf(ctx).bottom,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Novo pagamento',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<Patient>(
                    initialValue: selected,
                    items: patients
                        .map(
                          (p) =>
                              DropdownMenuItem(value: p, child: Text(p.name)),
                        )
                        .toList(),
                    onChanged: (p) => setModal(() => selected = p),
                    decoration: const InputDecoration(labelText: 'Paciente'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: amountCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Valor (R\$)'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: descCtrl,
                    decoration: const InputDecoration(labelText: 'Descrição'),
                  ),
                  const SizedBox(height: 12),
                  SegmentedButton<PaymentStatus>(
                    segments: const [
                      ButtonSegment(
                        value: PaymentStatus.received,
                        label: Text('Recebido'),
                      ),
                      ButtonSegment(
                        value: PaymentStatus.pending,
                        label: Text('Pendente'),
                      ),
                    ],
                    selected: {status},
                    onSelectionChanged: (s) => setModal(() => status = s.first),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: selected == null
                        ? null
                        : () async {
                            final amount =
                                double.tryParse(
                                  amountCtrl.text.replaceAll(',', '.'),
                                ) ??
                                0;
                            await PaymentService(uid).create(
                              Payment(
                                id: '',
                                patientId: selected!.id,
                                patientName: selected!.name,
                                amount: amount,
                                date: DateTime.now(),
                                status: status,
                                description: descCtrl.text.trim(),
                              ),
                            );
                            if (ctx.mounted) Navigator.pop(ctx);
                            setState(() {});
                          },
                    child: const Text('Salvar'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
