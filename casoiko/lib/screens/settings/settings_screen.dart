import 'package:flutter/material.dart';

import '../../services/auth_service.dart';
import '../../services/settings_service.dart';
import '../../theme/app_colors.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({
    super.key,
    required this.authService,
    required this.settingsService,
  });

  final AuthService authService;
  final SettingsService settingsService;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final user = authService.currentUser;
    final displayName = user?.displayName ?? 'Morador';
    final photoUrl = user?.photoURL;

    return Scaffold(
      appBar: AppBar(title: const Text('Configurações')),
      body: ListenableBuilder(
        listenable: settingsService,
        builder: (context, _) {
          final themeMode = settingsService.themeMode;

          return ListView(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: colors.border),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: colors.primarySoft,
                      backgroundImage:
                          photoUrl != null ? NetworkImage(photoUrl) : null,
                      child: photoUrl == null
                          ? Text(
                              displayName.characters.first.toUpperCase(),
                              style: TextStyle(
                                fontSize: 22,
                                color: colors.primary,
                                fontWeight: FontWeight.w700,
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
                            displayName,
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              color: colors.textPrimary,
                            ),
                          ),
                          if (user?.email != null)
                            Text(
                              user!.email!,
                              style: TextStyle(
                                fontSize: 13,
                                color: colors.textSecondary,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Aparência',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                  color: colors.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              _ThemeOptionTile(
                icon: Icons.brightness_auto_outlined,
                title: 'Seguir o sistema',
                subtitle: 'Claro ou escuro conforme o celular',
                selected: themeMode == ThemeMode.system,
                onTap: () =>
                    settingsService.setThemeMode(ThemeMode.system),
              ),
              _ThemeOptionTile(
                icon: Icons.light_mode_outlined,
                title: 'Claro',
                selected: themeMode == ThemeMode.light,
                onTap: () => settingsService.setThemeMode(ThemeMode.light),
              ),
              _ThemeOptionTile(
                icon: Icons.dark_mode_outlined,
                title: 'Escuro',
                selected: themeMode == ThemeMode.dark,
                onTap: () => settingsService.setThemeMode(ThemeMode.dark),
              ),
              const SizedBox(height: 24),
              Text(
                'Conta',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                  color: colors.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              Container(
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: colors.border),
                ),
                child: ListTile(
                  leading: Icon(Icons.logout, color: colors.danger),
                  title: Text(
                    'Sair da conta',
                    style: TextStyle(
                      color: colors.danger,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  onTap: () => authService.signOut(),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ThemeOptionTile extends StatelessWidget {
  const _ThemeOptionTile({
    required this.icon,
    required this.title,
    this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: selected ? colors.primary : colors.border,
                width: selected ? 1.5 : 1,
              ),
            ),
            child: ListTile(
              leading: Icon(
                icon,
                color: selected ? colors.primary : colors.textSecondary,
              ),
              title: Text(
                title,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: colors.textPrimary,
                ),
              ),
              subtitle: subtitle != null
                  ? Text(
                      subtitle!,
                      style: TextStyle(
                        fontSize: 12,
                        color: colors.textSecondary,
                      ),
                    )
                  : null,
              trailing: selected
                  ? Icon(Icons.check_circle, color: colors.primary)
                  : Icon(
                      Icons.circle_outlined,
                      color: colors.textSecondary.withValues(alpha: 0.4),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
