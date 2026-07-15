import 'package:flutter/material.dart';
import 'package:casoiko/theme/app_colors.dart';

import '../../services/notification_prefs.dart';
import 'settings_widgets.dart';

class SettingsNotificationsScreen extends StatefulWidget {
  const SettingsNotificationsScreen({super.key});

  @override
  State<SettingsNotificationsScreen> createState() =>
      _SettingsNotificationsScreenState();
}

class _SettingsNotificationsScreenState
    extends State<SettingsNotificationsScreen> {
  Map<String, bool>? _prefs;
  bool _loading = true;

  static const _items = [
    ('push', 'Push', 'Notificações do sistema'),
    ('chat', 'Chat', 'Mensagens da casa'),
    ('tarefas', 'Tarefas', 'Lembretes do dia'),
    ('contas', 'Contas', 'Vencimentos e pagamentos'),
    ('mercado', 'Mercado', 'Atualizações da lista'),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final prefs = await NotificationPrefs.loadAll();
    if (!mounted) return;
    setState(() {
      _prefs = prefs;
      _loading = false;
    });
  }

  Future<void> _set(String key, bool value) async {
    setState(() => _prefs = {...?_prefs, key: value});
    await NotificationPrefs.set(key, value);
  }

  @override
  Widget build(BuildContext context) {
    return SettingsScaffold(
      title: 'Notificações',
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                const SettingsSectionLabel('ALERTAS'),
                for (final item in _items) ...[
                  _ToggleCard(
                    title: item.$2,
                    subtitle: item.$3,
                    value: _prefs?[item.$1] ?? true,
                    onChanged: (v) => _set(item.$1, v),
                  ),
                  const SizedBox(height: 10),
                ],
                Text(
                  'Preferências salvas neste aparelho. Em breve serão sincronizadas com o servidor.',
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary.withValues(alpha: 0.9),
                  ),
                ),
              ],
            ),
    );
  }
}

class _ToggleCard extends StatelessWidget {
  const _ToggleCard({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: SwitchListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        title: Text(
          title,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: AppColors.textPrimary,
          ),
        ),
        subtitle: Text(
          subtitle,
          style: TextStyle(
            fontSize: 12,
            color: AppColors.textSecondary.withValues(alpha: 0.9),
          ),
        ),
        value: value,
        activeThumbColor: AppColors.primary,
        onChanged: onChanged,
      ),
    );
  }
}
