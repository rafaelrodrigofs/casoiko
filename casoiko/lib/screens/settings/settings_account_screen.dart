import 'package:flutter/material.dart';
import 'package:casoiko/theme/app_colors.dart';

import '../../services/auth_service.dart';
import 'settings_widgets.dart';

class SettingsAccountScreen extends StatelessWidget {
  const SettingsAccountScreen({super.key, required this.authService});

  final AuthService authService;

  @override
  Widget build(BuildContext context) {
    final user = authService.currentUser;
    final name = user?.displayName ?? '';
    final email = user?.email ?? '';
    final photo = user?.photoURL ?? '';

    return SettingsScaffold(
      title: 'Conta',
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 24, 16, 32),
        children: [
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 44,
                  backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                  backgroundImage:
                      photo.isNotEmpty ? NetworkImage(photo) : null,
                  child: photo.isEmpty
                      ? Icon(
                          Icons.person,
                          size: 40,
                          color: AppColors.primary,
                        )
                      : null,
                ),
                const SizedBox(height: 12),
                Text(
                  'Foto da conta Google',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          const SettingsSectionLabel('NOME'),
          _ReadonlyField(value: name.isEmpty ? '—' : name),
          const SizedBox(height: 16),
          const SettingsSectionLabel('E-MAIL'),
          _ReadonlyField(value: email.isEmpty ? '—' : email),
          const SizedBox(height: 24),
          Text(
            'Nome e e-mail vêm da sua conta Google e não podem ser editados aqui.',
            style: TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary.withValues(alpha: 0.9),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReadonlyField extends StatelessWidget {
  const _ReadonlyField({required this.value});

  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        value,
        style: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w500,
          color: AppColors.textPrimary,
        ),
      ),
    );
  }
}
