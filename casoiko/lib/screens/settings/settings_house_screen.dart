import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:casoiko/theme/app_colors.dart';

import '../../services/finance_service.dart';
import '../../services/house_service.dart';
import 'settings_widgets.dart';

class SettingsHouseScreen extends StatefulWidget {
  const SettingsHouseScreen({super.key, required this.houseId});

  final String houseId;

  @override
  State<SettingsHouseScreen> createState() => _SettingsHouseScreenState();
}

class _SettingsHouseScreenState extends State<SettingsHouseScreen> {
  final _houseService = HouseService();
  final _financeService = FinanceService();
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  bool _loaded = false;
  bool _saving = false;
  HouseInfo? _info;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final info = await _houseService.getHouse(widget.houseId);
    if (!mounted) return;
    setState(() {
      _info = info;
      _nameCtrl.text = info.name;
      _descCtrl.text = info.description;
      _loaded = true;
    });
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Informe o nome da casa')),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      await _houseService.updateHouse(
        houseId: widget.houseId,
        name: name,
        description: _descCtrl.text,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Dados salvos')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SettingsScaffold(
      title: 'Dados da casa',
      child: !_loaded
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 24, 16, 32),
              children: [
                const SettingsSectionLabel('NOME DA CASA'),
                TextField(
                  controller: _nameCtrl,
                  textCapitalization: TextCapitalization.words,
                  decoration: _dec(),
                ),
                const SizedBox(height: 16),
                const SettingsSectionLabel('DESCRIÇÃO'),
                TextField(
                  controller: _descCtrl,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: _dec(hint: 'Ex.: Casa da família'),
                ),
                const SizedBox(height: 20),
                const SettingsSectionLabel('RESUMO'),
                StreamBuilder(
                  stream: _financeService.membersStream(widget.houseId),
                  builder: (context, snap) {
                    final count = snap.data?.length ?? 0;
                    final created = _info?.createdAt;
                    final createdLabel = created == null
                        ? '—'
                        : 'Criada em ${DateFormat("MMM/yyyy", "pt_BR").format(created)}';
                    return Material(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(14),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '$count membro${count == 1 ? '' : 's'}',
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              createdLabel,
                              style: TextStyle(
                                fontSize: 13,
                                color: AppColors.textSecondary.withValues(
                                  alpha: 0.9,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: FilledButton(
                    onPressed: _saving ? null : _save,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
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
                ),
              ],
            ),
    );
  }

  InputDecoration _dec({String? hint}) {
    return InputDecoration(
      hintText: hint,
      filled: true,
      fillColor: AppColors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    );
  }
}
