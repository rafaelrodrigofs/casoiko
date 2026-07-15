import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:casoiko/theme/app_colors.dart';

import '../../services/admin_service.dart';
import '../../services/auth_service.dart';
import '../../services/finance_service.dart';
import '../settings/settings_hub_screen.dart';
import '../settings/settings_widgets.dart';
import 'admin_checks_screen.dart';
import 'admin_db_screen.dart';
import 'admin_viz_screen.dart';

class AdminHubScreen extends StatelessWidget {
  const AdminHubScreen({
    super.key,
    required this.authService,
    required this.houseId,
  });

  final AuthService authService;
  final String houseId;

  @override
  Widget build(BuildContext context) {
    final finance = FinanceService();
    final admin = AdminService();
    final uid = authService.currentUser?.uid;

    return SettingsScaffold(
      title: 'Admin',
      child: StreamBuilder(
        stream: finance.membersStream(houseId),
        builder: (context, membersSnap) {
          final members = membersSnap.data ?? [];
          if (membersSnap.hasData && !AdminService.canManage(members, uid)) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (context.mounted) Navigator.of(context).maybePop();
            });
            return const Center(child: Text('Sem permissão de admin.'));
          }

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            children: [
              _AdminBadgeCard(),
              const SizedBox(height: 12),
              const _TipCard(
                title: 'Sobre números do Perfil',
                body:
                    '“Concluídas” no topo = hoje. O anel usa 7/30/90 dias.',
              ),
              const SizedBox(height: 20),
              const SettingsSectionLabel('VISUALIZAÇÕES'),
              SettingsTile(
                icon: Icons.insights_outlined,
                title: 'Visualizações',
                subtitle: 'Resumos por membro, dia e categoria',
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => AdminVizScreen(
                        authService: authService,
                        houseId: houseId,
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 10),
              SettingsTile(
                icon: Icons.task_alt,
                title: 'Conclusões',
                subtitle: 'Listar checks e achar órfãos',
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => AdminChecksScreen(
                        authService: authService,
                        houseId: houseId,
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 20),
              const SettingsSectionLabel('DADOS & APP'),
              SettingsTile(
                icon: Icons.storage_outlined,
                title: 'Banco de dados',
                subtitle: 'Coleções Firestore e contagens',
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => AdminDbScreen(
                        authService: authService,
                        houseId: houseId,
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 10),
              SettingsTile(
                icon: Icons.download_outlined,
                title: 'Exportar casa',
                subtitle: 'Backup JSON para a área de transferência',
                onTap: () => _export(context, admin),
              ),
              const SizedBox(height: 10),
              SettingsTile(
                icon: Icons.settings_outlined,
                title: 'Configurações da casa',
                subtitle: 'Membros, conta e preferências',
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => SettingsHubScreen(
                        authService: authService,
                        houseId: houseId,
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 20),
              const SettingsSectionLabel('ZONA PERIGOSA'),
              SettingsTile(
                icon: Icons.delete_sweep_outlined,
                title: 'Limpeza',
                subtitle: 'Remover checks sem tarefa',
                danger: true,
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => AdminChecksScreen(
                        authService: authService,
                        houseId: houseId,
                        initialFilter: AdminCheckFilter.orphans,
                      ),
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

  Future<void> _export(BuildContext context, AdminService admin) async {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator()),
    );
    try {
      final json = await admin.exportHouseJson(houseId);
      await Clipboard.setData(ClipboardData(text: json));
      if (!context.mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('JSON da casa copiado.')),
      );
    } catch (e) {
      if (!context.mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Falha ao exportar: $e')),
      );
    }
  }
}

class _AdminBadgeCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.12),
        ),
      ),
      child: const Row(
        children: [
          Icon(Icons.verified_user, color: AppColors.primary, size: 28),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Painel do administrador',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Gerencie dados, visualizações e ferramentas',
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
    );
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
