import 'package:flutter/material.dart';
import 'package:casoiko/theme/app_colors.dart';

import '../../services/auth_service.dart';
import '../../services/push_service.dart';
import 'settings_about_screen.dart';
import 'settings_account_screen.dart';
import 'settings_house_screen.dart';
import 'settings_members_screen.dart';
import 'settings_notifications_screen.dart';
import 'settings_widgets.dart';

class SettingsHubScreen extends StatelessWidget {
  const SettingsHubScreen({
    super.key,
    required this.authService,
    required this.houseId,
  });

  final AuthService authService;
  final String houseId;

  Future<void> _signOut(BuildContext context) async {
    await PushService().clearForCurrentUser();
    await authService.signOut();
    if (context.mounted) {
      Navigator.of(context).popUntil((route) => route.isFirst);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = authService.currentUser;
    final name = user?.displayName ?? 'Morador';
    final email = user?.email ?? '';
    final photo = user?.photoURL ?? '';

    return SettingsScaffold(
      title: 'Configurações',
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Material(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 26,
                    backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                    backgroundImage:
                        photo.isNotEmpty ? NetworkImage(photo) : null,
                    child: photo.isEmpty
                        ? Text(
                            name.isNotEmpty ? name[0].toUpperCase() : '?',
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                              fontSize: 20,
                            ),
                          )
                        : null,
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        if (email.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            email,
                            style: TextStyle(
                              fontSize: 13,
                              color: AppColors.textSecondary.withValues(
                                alpha: 0.9,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          const SettingsSectionLabel('CONTA'),
          SettingsTile(
            icon: Icons.manage_accounts_outlined,
            title: 'Conta',
            subtitle: 'Nome, e-mail e foto',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => SettingsAccountScreen(authService: authService),
                ),
              );
            },
          ),
          const SizedBox(height: 10),
          SettingsTile(
            icon: Icons.notifications_outlined,
            title: 'Notificações',
            subtitle: 'Push e lembretes',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const SettingsNotificationsScreen(),
                ),
              );
            },
          ),
          const SizedBox(height: 20),
          const SettingsSectionLabel('CASA'),
          SettingsTile(
            icon: Icons.groups_outlined,
            title: 'Membros',
            subtitle: 'Quem participa da casa',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => SettingsMembersScreen(
                    houseId: houseId,
                    currentUid: user?.uid ?? '',
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 10),
          SettingsTile(
            icon: Icons.home_outlined,
            title: 'Dados da casa',
            subtitle: 'Nome e preferências',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => SettingsHouseScreen(houseId: houseId),
                ),
              );
            },
          ),
          const SizedBox(height: 20),
          const SettingsSectionLabel('APP'),
          SettingsTile(
            icon: Icons.info_outline,
            title: 'Sobre',
            subtitle: 'Versão e termos',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const SettingsAboutScreen(),
                ),
              );
            },
          ),
          const SizedBox(height: 16),
          SettingsTile(
            icon: Icons.logout_rounded,
            title: 'Sair da conta',
            danger: true,
            onTap: () => _signOut(context),
          ),
        ],
      ),
    );
  }
}
