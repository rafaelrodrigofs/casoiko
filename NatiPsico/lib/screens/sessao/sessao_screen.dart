import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:natipsico/theme/app_colors.dart';

import '../../models/appointment.dart';
import '../../models/patient.dart';
import '../../services/appointment_service.dart';
import '../../services/auth_service.dart';
import '../../services/patient_service.dart';
import '../../widgets/ui_bits.dart';

/// Detalhe unificado do atendimento (Agenda = Sessões).
class SessaoScreen extends StatefulWidget {
  const SessaoScreen({
    super.key,
    required this.authService,
    this.appointment,
    this.patientId,
    this.patientName,
  });

  final AuthService authService;
  final Appointment? appointment;
  final String? patientId;
  final String? patientName;

  @override
  State<SessaoScreen> createState() => _SessaoScreenState();
}

class _SessaoScreenState extends State<SessaoScreen> {
  final _evolution = TextEditingController();
  final _nextPlan = TextEditingController();
  final _notes = TextEditingController();

  AppointmentStatus _status = AppointmentStatus.pending;
  AppointmentType _type = AppointmentType.online;
  int _mood = 2;
  bool _saving = false;
  bool _loading = true;

  Patient? _patient;
  List<Patient> _patients = [];
  late DateTime _startsAt;
  String? _appointmentId;
  int _durationMin = 50;

  static const _moodLabels = ['Baixo', 'Estável', 'Bem', 'Ótimo'];

  static const _statuses = [
    AppointmentStatus.pending,
    AppointmentStatus.confirmed,
    AppointmentStatus.done,
    AppointmentStatus.missed,
    AppointmentStatus.cancelled,
  ];

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final uid = widget.authService.uid;
    if (uid == null) return;

    final appt = widget.appointment;
    if (appt != null) {
      _appointmentId = appt.id;
      _patient = Patient(
        id: appt.patientId,
        name: appt.patientName,
        phone: '',
        email: '',
        notes: '',
        status: PatientStatus.active,
        createdAt: DateTime.now(),
      );
      // Prefer full patient doc for initials etc.
      final full = await PatientService(uid).getById(appt.patientId);
      _patient = full ?? _patient;
      _startsAt = appt.startsAt;
      _durationMin = appt.durationMin;
      _type = appt.type;
      _status = appt.status;
      _mood = appt.mood;
      _evolution.text = appt.evolution;
      _nextPlan.text = appt.nextPlan;
      _notes.text = appt.notes;
    } else if (widget.patientId != null) {
      final p = await PatientService(uid).getById(widget.patientId!);
      _patient = p;
      _startsAt = DateTime.now();
      _status = AppointmentStatus.pending;
    } else {
      final list =
          await PatientService(uid).watchAll(status: PatientStatus.active).first;
      _patients = list;
      if (list.isNotEmpty) _patient = list.first;
      _startsAt = DateTime.now();
      _status = AppointmentStatus.pending;
    }

    if (mounted) setState(() => _loading = false);
  }

  @override
  void dispose() {
    _evolution.dispose();
    _nextPlan.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final uid = widget.authService.uid;
    final patient = _patient;
    if (uid == null || patient == null) return;

    setState(() => _saving = true);
    try {
      final service = AppointmentService(uid);
      final data = Appointment(
        id: _appointmentId ?? '',
        patientId: patient.id,
        patientName: patient.name,
        startsAt: _startsAt,
        durationMin: _durationMin,
        type: _type,
        status: _status,
        notes: _notes.text.trim(),
        evolution: _evolution.text.trim(),
        mood: _mood,
        nextPlan: _nextPlan.text.trim(),
      );

      if (_appointmentId == null || _appointmentId!.isEmpty) {
        await service.create(data);
      } else {
        await service.update(data.copyWith(id: _appointmentId));
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Atendimento salvo')),
      );
      Navigator.pop(context);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final patient = _patient;
    final when = DateFormat("EEE, d MMM · HH:mm", 'pt_BR').format(_startsAt);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: EdgeInsets.fromLTRB(
              8,
              MediaQuery.paddingOf(context).top + 4,
              16,
              24,
            ),
            decoration: const BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.chevron_left, size: 32),
                    ),
                    const Text(
                      'Atendimento',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                if (widget.appointment == null &&
                    widget.patientId == null &&
                    _patients.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 0, 12),
                    child: DropdownButtonFormField<Patient>(
                      initialValue: _patient,
                      items: _patients
                          .map(
                            (p) => DropdownMenuItem(
                              value: p,
                              child: Text(p.name),
                            ),
                          )
                          .toList(),
                      onChanged: (p) => setState(() => _patient = p),
                      decoration: const InputDecoration(
                        labelText: 'Paciente',
                        filled: true,
                        fillColor: Colors.white,
                      ),
                    ),
                  ),
                if (patient != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      children: [
                        PatientAvatar(
                          initials: patient.initials,
                          size: 56,
                          solid: true,
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                patient.name,
                                style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '$when · $_durationMin min',
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                _type == AppointmentType.online
                                    ? 'Online'
                                    : 'Presencial',
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.primary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 40),
              children: [
                const SectionTitle('Status do atendimento'),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _statuses.map((s) {
                    final selected = _status == s;
                    final probe = Appointment(
                      id: '',
                      patientId: '',
                      patientName: '',
                      startsAt: DateTime.now(),
                      status: s,
                    );
                    return InkWell(
                      onTap: () => setState(() => _status = s),
                      borderRadius: BorderRadius.circular(18),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          color: selected
                              ? probe.statusColor
                              : AppColors.surface,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                            color: selected
                                ? probe.statusColor
                                : AppColors.border,
                          ),
                        ),
                        child: Text(
                          probe.statusLabel,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: selected
                                ? Colors.white
                                : AppColors.textMuted,
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 20),
                SegmentedButton<AppointmentType>(
                  segments: const [
                    ButtonSegment(
                      value: AppointmentType.online,
                      label: Text('Online'),
                    ),
                    ButtonSegment(
                      value: AppointmentType.presencial,
                      label: Text('Presencial'),
                    ),
                  ],
                  selected: {_type},
                  onSelectionChanged: (s) => setState(() => _type = s.first),
                ),
                const SizedBox(height: 24),
                if (_status == AppointmentStatus.done) ...[
                  const SectionTitle('Evolução clínica'),
                  const SizedBox(height: 4),
                  const Text(
                    'Registro disponível com status Feita',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _evolution,
                    maxLines: 5,
                    decoration: const InputDecoration(
                      hintText: 'Como foi a sessão? O que foi trabalhado?',
                    ),
                  ),
                  const SizedBox(height: 20),
                  const SectionTitle('Humor na chegada'),
                  const SizedBox(height: 10),
                  Row(
                    children: List.generate(4, (i) {
                      final value = i + 1;
                      final selected = _mood == value;
                      return Expanded(
                        child: Padding(
                          padding: EdgeInsets.only(right: i < 3 ? 8 : 0),
                          child: InkWell(
                            onTap: () => setState(() => _mood = value),
                            borderRadius: BorderRadius.circular(16),
                            child: Container(
                              padding:
                                  const EdgeInsets.symmetric(vertical: 14),
                              decoration: BoxDecoration(
                                color: selected
                                    ? AppColors.primary
                                    : AppColors.surface,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: selected
                                      ? AppColors.primary
                                      : AppColors.border,
                                ),
                              ),
                              child: Text(
                                _moodLabels[i],
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 12,
                                  color: selected
                                      ? Colors.white
                                      : AppColors.textSecondary,
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 20),
                  const SectionTitle('Plano para próxima sessão'),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _nextPlan,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      hintText: 'O que avançar na próxima vez?',
                    ),
                  ),
                  const SizedBox(height: 20),
                ] else ...[
                  SoftCard(
                    color: AppColors.bgSoft,
                    child: Text(
                      _status == AppointmentStatus.missed
                          ? 'Paciente faltou. Evolução clínica fica oculta.'
                          : _status == AppointmentStatus.cancelled
                              ? 'Atendimento cancelado. Evolução clínica fica oculta.'
                              : 'Marque como Feita para registrar a evolução clínica.',
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
                const SectionTitle('Observação'),
                const SizedBox(height: 8),
                TextField(
                  controller: _notes,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    hintText: 'Ex.: acompanhamento semanal',
                  ),
                ),
                const SizedBox(height: 28),
                FilledButton(
                  onPressed: _saving || _patient == null ? null : _save,
                  child: _saving
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Salvar atendimento'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
