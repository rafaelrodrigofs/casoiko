import 'package:flutter/material.dart';
import 'package:casoiko/theme/app_colors.dart';

import 'settings_widgets.dart';

class SettingsAboutScreen extends StatelessWidget {
  const SettingsAboutScreen({super.key});

  static const _version = '1.0.0';

  void _soon(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Em breve')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SettingsScaffold(
      title: 'Sobre',
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 28, 16, 32),
        children: [
          Center(
            child: Column(
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: const Icon(Icons.home, color: Colors.white, size: 36),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Casoiko',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Versão $_version',
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          SettingsTile(
            icon: Icons.description_outlined,
            title: 'Termos de uso',
            onTap: () => _soon(context),
          ),
          const SizedBox(height: 10),
          SettingsTile(
            icon: Icons.privacy_tip_outlined,
            title: 'Política de privacidade',
            onTap: () => _soon(context),
          ),
          const SizedBox(height: 10),
          SettingsTile(
            icon: Icons.help_outline,
            title: 'Ajuda',
            onTap: () => _soon(context),
          ),
        ],
      ),
    );
  }
}
