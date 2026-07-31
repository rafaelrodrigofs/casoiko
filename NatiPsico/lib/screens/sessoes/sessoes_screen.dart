import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:natipsico/theme/app_colors.dart';

import '../../models/appointment.dart';
import '../../services/appointment_service.dart';
import '../../services/auth_service.dart';
import '../../utils/format.dart';
import '../../widgets/ui_bits.dart';
import '../sessao/sessao_screen.dart';

enum _SessoesFilter { all, done, pending, missed }

class SessoesScreen extends StatefulWidget {
  const SessoesScreen({super.key, required this.authService});

  final AuthService authService;

  @override
  State<SessoesScreen> createState() => _SessoesScreenState();
}

class _SessoesScreenState extends State<SessoesScreen> {
  _SessoesFilter _filter = _SessoesFilter.all;

  List<Appointment> _applyFilter(List<Appointment> list) {
    final now = DateTime.now();
    final monthList = list
        .where((a) =>
            a.startsAt.year == now.year && a.startsAt.month == now.month)
        .toList();

    switch (_filter) {
      case _SessoesFilter.all:
        return monthList;
      case _SessoesFilter.done:
        return monthList
            .where((a) => a.status == AppointmentStatus.done)
            .toList();
      case _SessoesFilter.pending:
        return monthList
            .where((a) =>
                a.status == AppointmentStatus.pending ||
                a.status == AppointmentStatus.confirmed)
            .toList();
      case _SessoesFilter.missed:
        return monthList
            .where((a) => a.status == AppointmentStatus.missed)
            .toList();
    }
  }

  @override
  Widget build(BuildContext context) {
    final uid = widget.authService.uid;
    if (uid == null) {
      return const Scaffold(body: Center(child: Text('Não autenticado')));
    }

    final service = AppointmentService(uid);
    final now = DateTime.now();
    final monthLabel = DateFormat('MMMM yyyy', 'pt_BR').format(now);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.chevron_left, size: 32),
                    color: AppColors.textPrimary,
                  ),
                  const Expanded(
                    child: Text(
                      'Sessões',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  Material(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(28),
                    child: InkWell(
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => SessaoScreen(
                              authService: widget.authService,
                            ),
                          ),
                        );
                      },
                      borderRadius: BorderRadius.circular(28),
                      child: const SizedBox(
                        width: 56,
                        height: 44,
                        child: Icon(Icons.add, color: Colors.white, size: 28),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: StreamBuilder<List<Appointment>>(
                stream: service.watchMonth(now),
                builder: (context, snap) {
                  final allMonth = snap.data ?? [];
                  final done = allMonth
                      .where((a) => a.status == AppointmentStatus.done)
                      .toList();
                  final list = _applyFilter(allMonth);
                  final totalMin =
                      done.fold<int>(0, (sum, a) => sum + a.durationMin);
                  final hours = totalMin ~/ 60;
                  final remMin = totalMin % 60;
                  final hoursLabel =
                      remMin == 0 ? '${hours}h' : '${hours}h ${remMin}min';

                  return ListView(
                    padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
                    children: [
                      Text(
                        'Mesma agenda · $monthLabel',
                        style: const TextStyle(
                          fontSize: 14,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 16),
                      SoftCard(
                        color: AppColors.primarySoft,
                        padding: const EdgeInsets.all(18),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${done.length}',
                                    style: const TextStyle(
                                      fontSize: 28,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.primary,
                                    ),
                                  ),
                                  const Text(
                                    'Feitas no mês',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    hoursLabel,
                                    style: const TextStyle(
                                      fontSize: 20,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                  const Text(
                                    'Tempo em sessão',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            _FilterChip(
                              label: 'Todas',
                              selected: _filter == _SessoesFilter.all,
                              onTap: () => setState(
                                () => _filter = _SessoesFilter.all,
                              ),
                            ),
                            const SizedBox(width: 8),
                            _FilterChip(
                              label: 'Feitas',
                              selected: _filter == _SessoesFilter.done,
                              onTap: () => setState(
                                () => _filter = _SessoesFilter.done,
                              ),
                            ),
                            const SizedBox(width: 8),
                            _FilterChip(
                              label: 'Pendente',
                              selected: _filter == _SessoesFilter.pending,
                              onTap: () => setState(
                                () => _filter = _SessoesFilter.pending,
                              ),
                            ),
                            const SizedBox(width: 8),
                            _FilterChip(
                              label: 'Faltou',
                              selected: _filter == _SessoesFilter.missed,
                              onTap: () => setState(
                                () => _filter = _SessoesFilter.missed,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (snap.connectionState == ConnectionState.waiting &&
                          !snap.hasData)
                        const Padding(
                          padding: EdgeInsets.only(top: 40),
                          child: Center(child: CircularProgressIndicator()),
                        )
                      else if (list.isEmpty)
                        const SoftCard(
                          child: Text(
                            'Nenhum atendimento neste filtro.',
                            style: TextStyle(color: AppColors.textSecondary),
                          ),
                        )
                      else
                        ...list.map((a) {
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: SoftCard(
                              onTap: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => SessaoScreen(
                                      authService: widget.authService,
                                      appointment: a,
                                    ),
                                  ),
                                );
                              },
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          '${dateShort.format(a.startsAt)} · ${timeHm.format(a.startsAt)}',
                                          style: TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w700,
                                            color: a.status ==
                                                    AppointmentStatus.cancelled
                                                ? AppColors.textMuted
                                                : a.status ==
                                                        AppointmentStatus.missed
                                                    ? a.statusColor
                                                    : AppColors.primary,
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          a.patientName,
                                          style: const TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.textPrimary,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          '${a.typeLabel} · ${a.durationMin} min · da Agenda',
                                          style: const TextStyle(
                                            fontSize: 12,
                                            color: AppColors.textSecondary,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: a.statusBg,
                                      borderRadius: BorderRadius.circular(11),
                                    ),
                                    child: Text(
                                      a.statusLabel,
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: a.statusColor,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        }),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.primary : AppColors.surface,
      borderRadius: BorderRadius.circular(selected ? 28 : 18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(selected ? 28 : 18),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(selected ? 28 : 18),
            border: selected ? null : Border.all(color: AppColors.border),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: selected ? AppColors.onPrimary : AppColors.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}
