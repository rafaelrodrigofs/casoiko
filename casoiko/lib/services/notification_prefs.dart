import 'package:shared_preferences/shared_preferences.dart';

/// Preferências locais de notificação (UI Configurações).
class NotificationPrefs {
  NotificationPrefs._();

  static const _keys = {
    'push': 'notif_pref_push',
    'chat': 'notif_pref_chat',
    'tarefas': 'notif_pref_tarefas',
    'contas': 'notif_pref_contas',
    'mercado': 'notif_pref_mercado',
  };

  static Future<Map<String, bool>> loadAll() async {
    final prefs = await SharedPreferences.getInstance();
    return {
      for (final e in _keys.entries) e.key: prefs.getBool(e.value) ?? true,
    };
  }

  static Future<void> set(String key, bool value) async {
    final storageKey = _keys[key];
    if (storageKey == null) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(storageKey, value);
  }
}
