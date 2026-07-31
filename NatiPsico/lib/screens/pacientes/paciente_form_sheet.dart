import 'package:flutter/material.dart';

import '../../models/patient.dart';
import '../../services/patient_service.dart';

class PacienteFormSheet extends StatefulWidget {
  const PacienteFormSheet({
    super.key,
    required this.service,
    this.patient,
  });

  final PatientService service;
  final Patient? patient;

  static Future<void> show(
    BuildContext context, {
    required PatientService service,
    Patient? patient,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => PacienteFormSheet(service: service, patient: patient),
    );
  }

  @override
  State<PacienteFormSheet> createState() => _PacienteFormSheetState();
}

class _PacienteFormSheetState extends State<PacienteFormSheet> {
  late final TextEditingController _name;
  late final TextEditingController _phone;
  late final TextEditingController _email;
  late final TextEditingController _frequency;
  String _modality = 'online';
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final p = widget.patient;
    _name = TextEditingController(text: p?.name ?? '');
    _phone = TextEditingController(text: p?.phone ?? '');
    _email = TextEditingController(text: p?.email ?? '');
    _frequency = TextEditingController(text: p?.frequency ?? 'Semanal');
    _modality = p?.modality ?? 'online';
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _email.dispose();
    _frequency.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.isEmpty) return;
    setState(() => _saving = true);
    try {
      if (widget.patient == null) {
        await widget.service.create(
          Patient(
            id: '',
            name: name,
            phone: _phone.text.trim(),
            email: _email.text.trim(),
            frequency: _frequency.text.trim(),
            modality: _modality,
          ),
        );
      } else {
        await widget.service.update(
          widget.patient!.copyWith(
            name: name,
            phone: _phone.text.trim(),
            email: _email.text.trim(),
            frequency: _frequency.text.trim(),
            modality: _modality,
          ),
        );
      }
      if (mounted) Navigator.pop(context);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        24,
        20,
        24,
        24 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              widget.patient == null ? 'Novo paciente' : 'Editar paciente',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _name,
              decoration: const InputDecoration(labelText: 'Nome'),
              textCapitalization: TextCapitalization.words,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _phone,
              decoration: const InputDecoration(labelText: 'Telefone'),
              keyboardType: TextInputType.phone,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _email,
              decoration: const InputDecoration(labelText: 'E-mail'),
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _frequency,
              decoration: const InputDecoration(labelText: 'Frequência'),
            ),
            const SizedBox(height: 12),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'online', label: Text('Online')),
                ButtonSegment(value: 'presencial', label: Text('Presencial')),
              ],
              selected: {_modality},
              onSelectionChanged: (s) => setState(() => _modality = s.first),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text('Salvar'),
            ),
          ],
        ),
      ),
    );
  }
}
