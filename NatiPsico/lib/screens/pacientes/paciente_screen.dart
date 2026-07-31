import 'package:flutter/material.dart';
import 'package:natipsico/theme/app_colors.dart';

import '../../models/appointment.dart';
import '../../models/patient.dart';
import '../../services/appointment_service.dart';
import '../../services/auth_service.dart';
import '../../services/patient_service.dart';
import '../../utils/format.dart';
import '../../widgets/ui_bits.dart';
import '../sessao/sessao_screen.dart';
import 'paciente_form_sheet.dart';

class PacienteScreen extends StatelessWidget {
  const PacienteScreen({
    super.key,
    required this.authService,
    required this.patientId,
  });

  final AuthService authService;
  final String patientId;

  @override
  Widget build(BuildContext context) {
    final uid = authService.uid;
    if (uid == null) return const SizedBox.shrink();
    final patientService = PatientService(uid);
    final apptService = AppointmentService(uid);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Paciente'),
        actions: [
          IconButton(
            icon: const Icon(Icons.more_horiz),
            onPressed: () async {
              final patient = await patientService.getById(patientId);
              if (patient == null || !context.mounted) return;
              showModalBottomSheet<void>(
                context: context,
                builder: (ctx) => SafeArea(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ListTile(
                        leading: const Icon(Icons.edit_outlined),
                        title: const Text('Editar'),
                        onTap: () {
                          Navigator.pop(ctx);
                          PacienteFormSheet.show(
                            context,
                            service: patientService,
                            patient: patient,
                          );
                        },
                      ),
                      ListTile(
                        leading: Icon(
                          patient.status == PatientStatus.archived
                              ? Icons.unarchive_outlined
                              : Icons.archive_outlined,
                        ),
                        title: Text(
                          patient.status == PatientStatus.archived
                              ? 'Reativar'
                              : 'Arquivar',
                        ),
                        onTap: () async {
                          await patientService.setArchived(
                            patientId,
                            patient.status != PatientStatus.archived,
                          );
                          if (ctx.mounted) Navigator.pop(ctx);
                        },
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
      body: FutureBuilder<Patient?>(
        future: patientService.getById(patientId),
        builder: (context, snap) {
          final p = snap.data;
          if (p == null) {
            return const Center(child: CircularProgressIndicator());
          }
          return ListView(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 40),
            children: [
              Center(child: PatientAvatar(initials: p.initials, size: 72)),
              const SizedBox(height: 12),
              Text(
                p.name,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                [
                  if (p.age != null) '${p.age} anos',
                  'Psicoterapia individual',
                ].join(' • '),
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: FilledButton(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => SessaoScreen(
                              authService: authService,
                              patientId: p.id,
                              patientName: p.name,
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
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Mensagens em breve'),
                          ),
                        );
                      },
                      child: const Text('Mensagem'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              const SectionTitle('Dados principais'),
              const SizedBox(height: 8),
              SoftCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (p.phone.isNotEmpty) Text(p.phone),
                    if (p.email.isNotEmpty) Text(p.email),
                    Text(
                      p.startedAt != null
                          ? 'Paciente desde ${dateShort.format(p.startedAt!)}'
                          : 'Cadastro recente',
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              const SectionTitle('Acompanhamento'),
              const SizedBox(height: 8),
              FutureBuilder<int>(
                future: apptService.countDoneForPatient(patientId),
                builder: (context, countSnap) {
                  final n = countSnap.data ?? 0;
                  return Row(
                    children: [
                      Expanded(
                        child: SoftCard(
                          color: AppColors.primarySoft,
                          child: Column(
                            children: [
                              Text(
                                '$n',
                                style: const TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.primary,
                                ),
                              ),
                              const Text(
                                'Sessões',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: SoftCard(
                          color: AppColors.primarySoft,
                          child: Column(
                            children: [
                              Text(
                                n == 0 ? '—' : '92%',
                                style: const TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.primary,
                                ),
                              ),
                              const Text(
                                'Frequência',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: SoftCard(
                          color: AppColors.primarySoft,
                          child: const Column(
                            children: [
                              Text(
                                '↗',
                                style: TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.primary,
                                ),
                              ),
                              Text(
                                'Evolução',
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
              const SectionTitle('Última sessão'),
              const SizedBox(height: 8),
              FutureBuilder<Appointment?>(
                future: apptService.latestDoneForPatient(patientId),
                builder: (context, sSnap) {
                  final s = sSnap.data;
                  if (s == null) {
                    return const SoftCard(
                      child: Text(
                        'Nenhuma sessão feita ainda.',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                    );
                  }
                  return SoftCard(
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => SessaoScreen(
                            authService: authService,
                            appointment: s,
                          ),
                        ),
                      );
                    },
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${dateShort.format(s.startsAt)} • ${timeHm.format(s.startsAt)}',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          s.evolution.isEmpty
                              ? 'Sem notas de evolução.'
                              : s.evolution,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ],
          );
        },
      ),
    );
  }
}
