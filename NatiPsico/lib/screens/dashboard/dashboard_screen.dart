import 'package:flutter/material.dart';
import 'package:natipsico/theme/app_colors.dart';

import '../../models/appointment.dart';
import '../../services/appointment_service.dart';
import '../../services/auth_service.dart';
import '../../services/payment_service.dart';
import '../../utils/format.dart';
import '../../widgets/ui_bits.dart';
import '../pacientes/pacientes_screen.dart';
import '../perfil/perfil_screen.dart';
import '../sessao/sessao_screen.dart';
import '../sessoes/sessoes_screen.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key, required this.authService});

  final AuthService authService;

  @override
  Widget build(BuildContext context) {
    final uid = authService.uid;
    if (uid == null) {
      return const Center(child: Text('Não autenticado'));
    }

    final displayName = authService.currentUser?.displayName?.trim();
    final name = (displayName?.isNotEmpty == true)
        ? displayName!.split(' ').first
        : 'Natalia';
    final initials = initialsFromName(displayName, fallback: 'NF');
    final today = DateTime.now();
    final apptService = AppointmentService(uid);
    final paymentService = PaymentService(uid);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 28),
                decoration: const BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.vertical(
                    bottom: Radius.circular(28),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${greetingForNow()}, $name',
                            style: const TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            dateFull.format(today),
                            style: const TextStyle(
                              fontSize: 14,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 20),
                          StreamBuilder<List<Appointment>>(
                            stream: apptService.watchDay(today),
                            builder: (context, snap) {
                              // Cancelados não contam como atendimento do dia.
                              final count = snap.data
                                      ?.where((a) =>
                                          a.status !=
                                          AppointmentStatus.cancelled)
                                      .length ??
                                  0;
                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Hoje você tem',
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                  Text(
                                    '$count atendimento${count == 1 ? '' : 's'}',
                                    style: const TextStyle(
                                      fontSize: 28,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                ],
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                    PatientAvatar(
                      initials: initials,
                      size: 44,
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => PerfilScreen(
                              authService: authService,
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 120),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  SectionTitle(
                    'Próximos atendimentos',
                    trailing: TextButton(
                      onPressed: () {
                        // Shell is IndexedStack — user switches via nav.
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Use a aba Agenda na barra inferior'),
                          ),
                        );
                      },
                      child: const Text(
                        'Ver agenda',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  StreamBuilder<List<Appointment>>(
                    stream: apptService.watchDay(today),
                    builder: (context, snap) {
                      final list = snap.data ?? [];
                      if (list.isEmpty) {
                        return const SoftCard(
                          child: Text(
                            'Nenhum atendimento hoje.',
                            style: TextStyle(color: AppColors.textSecondary),
                          ),
                        );
                      }
                      return Column(
                        children: list.take(3).map((a) {
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: SoftCard(
                              onTap: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => SessaoScreen(
                                      authService: authService,
                                      appointment: a,
                                    ),
                                  ),
                                );
                              },
                              child: Row(
                                children: [
                                  Text(
                                    timeHm.format(a.startsAt),
                                    style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      color: a.statusColor,
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          a.patientName,
                                          style: const TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        Text(
                                          '${a.typeLabel} · ${a.statusLabel} · ${a.durationMin} min',
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
                        }).toList(),
                      );
                    },
                  ),
                  const SizedBox(height: 16),
                  const SectionTitle('Resumo do mês'),
                  const SizedBox(height: 12),
                  FutureBuilder(
                    future: Future.wait([
                      apptService.countDoneInMonth(today),
                      paymentService.summaryForMonth(today),
                    ]),
                    builder: (context, snap) {
                      final sessions = snap.hasData
                          ? snap.data![0] as int
                          : 0;
                      final summary = snap.hasData
                          ? snap.data![1] as PaymentSummary
                          : const PaymentSummary(
                              received: 0,
                              pending: 0,
                              receivedCount: 0,
                              pendingCount: 0,
                            );
                      return Row(
                        children: [
                          Expanded(
                            child: SoftCard(
                              color: AppColors.primarySoft,
                              onTap: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => SessoesScreen(
                                      authService: authService,
                                    ),
                                  ),
                                );
                              },
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '$sessions',
                                    style: const TextStyle(
                                      fontSize: 28,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.primary,
                                    ),
                                  ),
                                  const Text(
                                    'Sessões realizadas',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: SoftCard(
                              color: AppColors.primarySoft,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    currencyBrl.format(summary.received),
                                    style: const TextStyle(
                                      fontSize: 22,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.primary,
                                    ),
                                  ),
                                  const Text(
                                    'Receita confirmada',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 20),
                  const SectionTitle('Acesso rápido'),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton(
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => SessaoScreen(
                                  authService: authService,
                                ),
                              ),
                            );
                          },
                          child: const Text('+ Nova sessão'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => PacientesScreen(
                                  authService: authService,
                                  asPage: true,
                                ),
                              ),
                            );
                          },
                          child: const Text('+ Paciente'),
                        ),
                      ),
                    ],
                  ),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
