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

class AgendaScreen extends StatefulWidget {
  const AgendaScreen({super.key, required this.authService});

  final AuthService authService;

  @override
  State<AgendaScreen> createState() => _AgendaScreenState();
}

class _AgendaScreenState extends State<AgendaScreen> {
  late DateTime _month;
  late DateTime _selectedDay;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = DateTime(now.year, now.month);
    _selectedDay = startOfDay(now);
  }

  @override
  Widget build(BuildContext context) {
    final uid = widget.authService.uid;
    if (uid == null) return const SizedBox.shrink();
    final service = AppointmentService(uid);

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
                      'Agenda',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => _showAddSheet(context, uid),
                    icon: const Icon(Icons.add_circle, color: AppColors.primary),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SoftCard(
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: [
                    Row(
                      children: [
                        IconButton(
                          onPressed: () {
                            setState(() {
                              _month = DateTime(_month.year, _month.month - 1);
                            });
                          },
                          icon: const Icon(Icons.chevron_left),
                        ),
                        Expanded(
                          child: Text(
                            monthYear.format(_month),
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                        IconButton(
                          onPressed: () {
                            setState(() {
                              _month = DateTime(_month.year, _month.month + 1);
                            });
                          },
                          icon: const Icon(Icons.chevron_right),
                        ),
                      ],
                    ),
                    StreamBuilder<List<Appointment>>(
                      stream: service.watchMonth(_month),
                      builder: (context, snap) {
                        final daysWithAppt = <int>{};
                        for (final a in snap.data ?? []) {
                          if (a.startsAt.month == _month.month) {
                            daysWithAppt.add(a.startsAt.day);
                          }
                        }
                        return _MonthGrid(
                          month: _month,
                          selected: _selectedDay,
                          markedDays: daysWithAppt,
                          onSelect: (d) => setState(() => _selectedDay = d),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  _isSameDay(_selectedDay, DateTime.now())
                      ? 'Hoje, ${dateShort.format(_selectedDay)}'
                      : dateShort.format(_selectedDay),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            Expanded(
              child: StreamBuilder<List<Appointment>>(
                stream: service.watchDay(_selectedDay),
                builder: (context, snap) {
                  final list = snap.data ?? [];
                  if (list.isEmpty) {
                    return const Padding(
                      padding: EdgeInsets.all(24),
                      child: Text(
                        'Sem atendimentos neste dia.',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                    );
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(24, 0, 24, 120),
                    itemCount: list.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (context, i) {
                      final a = list[i];
                      return SoftCard(
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
                          children: [
                            Container(
                              width: 4,
                              height: 48,
                              decoration: BoxDecoration(
                                color: a.statusColor,
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                            const SizedBox(width: 14),
                            Text(
                              timeHm.format(a.startsAt),
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                color: a.statusColor,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    a.patientName,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 16,
                                    ),
                                  ),
                                  Text(
                                    '${a.typeLabel} · ${a.statusLabel}',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              a.statusLabel,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: a.statusColor,
                              ),
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
        ),
      ),
    );
  }

  bool _isSameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  Future<void> _showAddSheet(BuildContext context, String uid) async {
    final patients = await PatientService(uid).watchAll().first;
    if (!context.mounted) return;
    if (patients.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cadastre um paciente primeiro.')),
      );
      return;
    }

    Patient? selected = patients.first;
    var time = TimeOfDay.fromDateTime(
      DateTime(_selectedDay.year, _selectedDay.month, _selectedDay.day, 9),
    );
    var type = AppointmentType.online;
    var status = AppointmentStatus.pending;

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
                24 + MediaQuery.paddingOf(ctx).bottom,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Novo atendimento',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<Patient>(
                    initialValue: selected,
                    items: patients
                        .map(
                          (p) => DropdownMenuItem(
                            value: p,
                            child: Text(p.name),
                          ),
                        )
                        .toList(),
                    onChanged: (p) => setModal(() => selected = p),
                    decoration: const InputDecoration(labelText: 'Paciente'),
                  ),
                  const SizedBox(height: 12),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('Horário: ${time.format(ctx)}'),
                    trailing: const Icon(Icons.access_time),
                    onTap: () async {
                      final picked = await showTimePicker(
                        context: ctx,
                        initialTime: time,
                      );
                      if (picked != null) setModal(() => time = picked);
                    },
                  ),
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
                    selected: {type},
                    onSelectionChanged: (s) => setModal(() => type = s.first),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: selected == null
                        ? null
                        : () async {
                            final starts = DateTime(
                              _selectedDay.year,
                              _selectedDay.month,
                              _selectedDay.day,
                              time.hour,
                              time.minute,
                            );
                            await AppointmentService(uid).create(
                              Appointment(
                                id: '',
                                patientId: selected!.id,
                                patientName: selected!.name,
                                startsAt: starts,
                                type: type,
                                status: status,
                              ),
                            );
                            if (ctx.mounted) Navigator.pop(ctx);
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

class _MonthGrid extends StatelessWidget {
  const _MonthGrid({
    required this.month,
    required this.selected,
    required this.markedDays,
    required this.onSelect,
  });

  final DateTime month;
  final DateTime selected;
  final Set<int> markedDays;
  final ValueChanged<DateTime> onSelect;

  @override
  Widget build(BuildContext context) {
    final first = DateTime(month.year, month.month, 1);
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    // Monday-based: weekday 1=Mon … 7=Sun
    final lead = first.weekday - 1;
    final cells = lead + daysInMonth;

    return Column(
      children: [
        Row(
          children: [
            for (final d in ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'])
              Expanded(
                child: Center(
                  child: Text(
                    d,
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textMuted,
                    ),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        for (var row = 0; row < (cells / 7).ceil(); row++)
          Row(
            children: List.generate(7, (col) {
              final index = row * 7 + col;
              final dayNum = index - lead + 1;
              if (dayNum < 1 || dayNum > daysInMonth) {
                return const Expanded(child: SizedBox(height: 40));
              }
              final date = DateTime(month.year, month.month, dayNum);
              final isSelected = date.year == selected.year &&
                  date.month == selected.month &&
                  date.day == selected.day;
              final marked = markedDays.contains(dayNum);
              return Expanded(
                child: InkWell(
                  onTap: () => onSelect(date),
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    height: 40,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: isSelected ? AppColors.primary : null,
                      shape: BoxShape.circle,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          '$dayNum',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: isSelected
                                ? Colors.white
                                : AppColors.textPrimary,
                          ),
                        ),
                        if (marked && !isSelected)
                          Container(
                            width: 4,
                            height: 4,
                            decoration: const BoxDecoration(
                              color: AppColors.primary,
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              );
            }),
          ),
      ],
    );
  }
}
