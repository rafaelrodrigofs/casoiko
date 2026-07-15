import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:casoiko/theme/app_colors.dart';

import '../../models/finance_transaction.dart';
import '../../services/admin_service.dart';
import '../../services/auth_service.dart';
import '../../services/finance_service.dart';
import '../settings/settings_widgets.dart';

class AdminDbScreen extends StatefulWidget {
  const AdminDbScreen({
    super.key,
    required this.authService,
    required this.houseId,
  });

  final AuthService authService;
  final String houseId;

  @override
  State<AdminDbScreen> createState() => _AdminDbScreenState();
}

class _AdminDbScreenState extends State<AdminDbScreen> {
  final _admin = AdminService();
  late Future<AdminDbCounts> _countsFuture;
  bool _exporting = false;

  @override
  void initState() {
    super.initState();
    _countsFuture = _admin.fetchDbCounts(widget.houseId);
  }

  void _refresh() {
    setState(() {
      _countsFuture = _admin.fetchDbCounts(widget.houseId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final finance = FinanceService();
    final uid = widget.authService.currentUser?.uid;

    return SettingsScaffold(
      title: 'Banco de dados',
      child: StreamBuilder<List<HouseMember>>(
        stream: finance.membersStream(widget.houseId),
        builder: (context, membersSnap) {
          final members = membersSnap.data ?? [];
          if (membersSnap.hasData && !AdminService.canManage(members, uid)) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (context.mounted) Navigator.of(context).maybePop();
            });
            return const SizedBox.shrink();
          }

          return FutureBuilder<AdminDbCounts>(
            future: _countsFuture,
            builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting &&
                  !snap.hasData) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snap.hasError) {
                return Center(child: Text('Erro: ${snap.error}'));
              }
              final c = snap.data!;

              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                children: [
                  const _TipCard(
                    title: 'Somente leitura por padrão',
                    body:
                        'Use limpeza só depois de revisar órfãos e exportar backup.',
                  ),
                  const SizedBox(height: 16),
                  const SettingsSectionLabel('COLEÇÕES'),
                  _DbRow(
                    title: 'tasks',
                    meta: '${c.tasks} documentos',
                  ),
                  const SizedBox(height: 8),
                  _DbRow(
                    title: 'task_checks',
                    meta:
                        '${c.taskChecks} documentos · ${c.orphanChecks} órfãos',
                  ),
                  const SizedBox(height: 8),
                  _DbRow(
                    title: 'houses / members',
                    meta: '1 casa · ${c.members} membros',
                  ),
                  const SizedBox(height: 8),
                  _DbRow(
                    title: 'market_lists / items',
                    meta: '${c.marketLists} listas · ${c.marketItems} itens',
                  ),
                  const SizedBox(height: 8),
                  _DbRow(
                    title: 'finance / bills',
                    meta:
                        '${c.bills} contas · ${c.transactions} lançamentos',
                  ),
                  const SizedBox(height: 8),
                  _DbRow(
                    title: 'messages',
                    meta: '${c.messages} mensagens',
                  ),
                  const SizedBox(height: 20),
                  const SettingsSectionLabel('FERRAMENTAS'),
                  SettingsTile(
                    icon: Icons.sync,
                    title: 'Recalcular contagens',
                    subtitle: 'Atualiza o resumo do painel',
                    onTap: _refresh,
                  ),
                  const SizedBox(height: 10),
                  SettingsTile(
                    icon: Icons.ios_share,
                    title: 'Exportar casa (JSON)',
                    subtitle: _exporting
                        ? 'Exportando…'
                        : 'Copia para a área de transferência',
                    onTap: _exporting ? null : _export,
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }

  Future<void> _export() async {
    setState(() => _exporting = true);
    try {
      final json = await _admin.exportHouseJson(widget.houseId);
      await Clipboard.setData(ClipboardData(text: json));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('JSON da casa copiado.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Falha ao exportar: $e')),
      );
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }
}

class _TipCard extends StatelessWidget {
  const _TipCard({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.lightbulb_outline, color: AppColors.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  body,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DbRow extends StatelessWidget {
  const _DbRow({required this.title, required this.meta});

  final String title;
  final String meta;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            meta,
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
