import 'package:flutter/material.dart';
import 'package:natipsico/theme/app_colors.dart';

import '../../models/patient.dart';
import '../../services/auth_service.dart';
import '../../services/patient_service.dart';
import '../../widgets/ui_bits.dart';
import 'paciente_form_sheet.dart';
import 'paciente_screen.dart';

class PacientesScreen extends StatefulWidget {
  const PacientesScreen({
    super.key,
    required this.authService,
    this.asPage = false,
  });

  final AuthService authService;
  final bool asPage;

  @override
  State<PacientesScreen> createState() => _PacientesScreenState();
}

class _PacientesScreenState extends State<PacientesScreen> {
  String _query = '';
  PatientStatus? _filter = PatientStatus.active;

  @override
  Widget build(BuildContext context) {
    final uid = widget.authService.uid;
    if (uid == null) return const SizedBox.shrink();
    final service = PatientService(uid);

    final body = Column(
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(24, widget.asPage ? 8 : 16, 16, 8),
          child: Row(
            children: [
              const Expanded(
                child: Text(
                  'Pacientes',
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700),
                ),
              ),
              IconButton(
                onPressed: () => PacienteFormSheet.show(
                  context,
                  service: service,
                ),
                icon: const Icon(Icons.add_circle, color: AppColors.primary),
              ),
            ],
          ),
        ),
        StreamBuilder<List<Patient>>(
          stream: service.watchAll(status: PatientStatus.active),
          builder: (context, snap) {
            final n = snap.data?.length ?? 0;
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  '$n pacientes ativos',
                  style: const TextStyle(color: AppColors.textSecondary),
                ),
              ),
            );
          },
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 8),
          child: TextField(
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Buscar paciente',
            ),
            onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Row(
            children: [
              _chip('Todos', null),
              const SizedBox(width: 8),
              _chip('Ativos', PatientStatus.active),
              const SizedBox(width: 8),
              _chip('Arquivados', PatientStatus.archived),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: StreamBuilder<List<Patient>>(
            stream: service.watchAll(status: _filter),
            builder: (context, snap) {
              var list = snap.data ?? [];
              if (_query.isNotEmpty) {
                list = list
                    .where((p) => p.name.toLowerCase().contains(_query))
                    .toList();
              }
              if (list.isEmpty) {
                return const Center(
                  child: Text(
                    'Nenhum paciente encontrado.',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.fromLTRB(24, 8, 24, 120),
                itemCount: list.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, i) {
                  final p = list[i];
                  return SoftCard(
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => PacienteScreen(
                            authService: widget.authService,
                            patientId: p.id,
                          ),
                        ),
                      );
                    },
                    child: Row(
                      children: [
                        PatientAvatar(initials: p.initials),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                p.name,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 16,
                                ),
                              ),
                              Text(
                                '${p.frequency} • ${p.modality == 'online' ? 'Online' : 'Presencial'}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Icon(
                          Icons.chevron_right,
                          color: AppColors.textMuted,
                        ),
                      ],
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );

    if (widget.asPage) {
      return Scaffold(
        appBar: AppBar(title: const Text('Pacientes')),
        body: SafeArea(child: body),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(bottom: false, child: body),
    );
  }

  Widget _chip(String label, PatientStatus? status) {
    final selected = _filter == status;
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => setState(() => _filter = status),
      selectedColor: AppColors.primarySoft,
      labelStyle: TextStyle(
        color: selected ? AppColors.primaryDark : AppColors.textSecondary,
        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
      ),
      side: BorderSide(
        color: selected ? AppColors.primary : AppColors.border,
      ),
      backgroundColor: AppColors.surface,
    );
  }
}
