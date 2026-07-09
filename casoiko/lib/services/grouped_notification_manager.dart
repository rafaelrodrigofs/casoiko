import 'dart:convert';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'notification_service.dart';

/// Monta as notificacoes de push agrupadas por contexto (estilo WhatsApp):
///
/// - **Chat**: uma unica notificacao no estilo grupo ([MessagingStyleInformation]),
///   empilhando "Nome: mensagem".
/// - **Mercado**: uma unica notificacao [InboxStyleInformation] listando itens.
/// - **Tarefas**: uma unica notificacao [InboxStyleInformation] listando conclusoes.
///
/// O agrupamento acontece porque cada contexto reusa um ID fixo (reemitir com
/// o mesmo ID atualiza a notificacao) e guarda o historico das ultimas linhas
/// em [SharedPreferences] para reconstruir a lista mesmo com o app fechado.
class GroupedNotificationManager {
  GroupedNotificationManager._();

  static final GroupedNotificationManager instance =
      GroupedNotificationManager._();

  // IDs fixos por contexto. Reemitir no mesmo ID = atualiza em vez de duplicar.
  static const int _summaryId = 1000;
  static const int _chatId = 1001;
  static const int _marketId = 1002;
  static const int _taskId = 1003;

  static const String _groupKey = 'casoiko_updates';

  // Reusa o canal ja criado em NotificationService.init().
  static const String _channelId = 'casa_updates';
  static const String _channelName = 'Novidades da casa';
  static const String _channelDescription =
      'Mensagens, mercado e tarefas concluidas pela familia.';

  static const String _chatKey = 'notif_chat';
  static const String _marketKey = 'notif_market';
  static const String _taskKey = 'notif_task';
  static const int _maxLines = 8;

  /// Ponto de entrada: recebe o `data` do push e roteia pelo campo `type`.
  Future<void> handleData(Map<String, dynamic> data) async {
    await NotificationService.instance.init();

    final type = data['type']?.toString();
    switch (type) {
      case 'chat':
        await _handleChat(data);
        break;
      case 'market':
        await _handleMarket(data);
        break;
      case 'task':
        await _handleTask(data);
        break;
      default:
        break;
    }
  }

  FlutterLocalNotificationsPlugin get _plugin =>
      NotificationService.instance.plugin;

  // ---------------------------------------------------------------------------
  // Chat (MessagingStyle)
  // ---------------------------------------------------------------------------

  Future<void> _handleChat(Map<String, dynamic> data) async {
    final sender = (data['senderName']?.toString() ?? 'Alguem').trim();
    final text = data['text']?.toString() ?? '';

    final prefs = await SharedPreferences.getInstance();
    final history = _loadChatHistory(prefs);
    history.add({
      's': sender,
      't': text,
      'ts': DateTime.now().millisecondsSinceEpoch,
    });
    while (history.length > _maxLines) {
      history.removeAt(0);
    }
    await prefs.setString(_chatKey, jsonEncode(history));

    final messages = history
        .map(
          (m) => Message(
            m['t']?.toString() ?? '',
            DateTime.fromMillisecondsSinceEpoch(
              (m['ts'] as num?)?.toInt() ??
                  DateTime.now().millisecondsSinceEpoch,
            ),
            Person(name: m['s']?.toString() ?? 'Alguem'),
          ),
        )
        .toList();

    final style = MessagingStyleInformation(
      Person(name: 'Casa'),
      conversationTitle: 'Casa',
      groupConversation: true,
      messages: messages,
    );

    await _plugin.show(
      id: _chatId,
      title: 'Casa',
      body: '$sender: $text',
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          channelDescription: _channelDescription,
          importance: Importance.high,
          priority: Priority.high,
          groupKey: _groupKey,
          styleInformation: style,
          icon: '@mipmap/ic_launcher',
        ),
      ),
      payload: 'chat',
    );

    await _showSummary();
  }

  // ---------------------------------------------------------------------------
  // Mercado / Tarefas (InboxStyle)
  // ---------------------------------------------------------------------------

  Future<void> _handleMarket(Map<String, dynamic> data) async {
    final who = (data['addedByName']?.toString() ?? 'Alguem').trim();
    final item = data['itemName']?.toString() ?? '';
    final line = item.isEmpty ? who : '$who: $item';

    await _handleInbox(
      prefsKey: _marketKey,
      notificationId: _marketId,
      line: line,
      titleBuilder: (count) => 'Novos itens no mercado ($count)',
      summaryText: 'Mercado',
      payload: 'mercado',
    );
  }

  Future<void> _handleTask(Map<String, dynamic> data) async {
    final who = (data['doneByName']?.toString() ?? 'Alguem').trim();
    final task = data['taskTitle']?.toString() ?? 'uma tarefa';
    final line = '$who concluiu: $task';

    await _handleInbox(
      prefsKey: _taskKey,
      notificationId: _taskId,
      line: line,
      titleBuilder: (count) => 'Tarefas concluidas ($count)',
      summaryText: 'Tarefas',
      payload: 'casa',
    );
  }

  Future<void> _handleInbox({
    required String prefsKey,
    required int notificationId,
    required String line,
    required String Function(int count) titleBuilder,
    required String summaryText,
    required String payload,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final lines = prefs.getStringList(prefsKey) ?? <String>[];
    lines.add(line);
    while (lines.length > _maxLines) {
      lines.removeAt(0);
    }
    await prefs.setStringList(prefsKey, lines);

    final title = titleBuilder(lines.length);
    final style = InboxStyleInformation(
      lines,
      contentTitle: title,
      summaryText: summaryText,
    );

    await _plugin.show(
      id: notificationId,
      title: title,
      body: line,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          channelDescription: _channelDescription,
          importance: Importance.high,
          priority: Priority.high,
          groupKey: _groupKey,
          styleInformation: style,
          icon: '@mipmap/ic_launcher',
        ),
      ),
      payload: payload,
    );

    await _showSummary();
  }

  // ---------------------------------------------------------------------------
  // Resumo do grupo
  // ---------------------------------------------------------------------------

  Future<void> _showSummary() async {
    await _plugin.show(
      id: _summaryId,
      title: 'Casoiko',
      body: 'Novidades da casa',
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          channelDescription: _channelDescription,
          importance: Importance.high,
          priority: Priority.high,
          groupKey: _groupKey,
          setAsGroupSummary: true,
          icon: '@mipmap/ic_launcher',
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Limpeza ao abrir cada tela
  // ---------------------------------------------------------------------------

  Future<void> clearChat() => _clear(_chatKey, _chatId);

  Future<void> clearMarket() => _clear(_marketKey, _marketId);

  Future<void> clearTasks() => _clear(_taskKey, _taskId);

  Future<void> _clear(String prefsKey, int notificationId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(prefsKey);
    await _plugin.cancel(id: notificationId);

    // Se nao sobrou nenhum contexto ativo, remove tambem o resumo.
    final hasAny = _hasChat(prefs) ||
        (prefs.getStringList(_marketKey)?.isNotEmpty ?? false) ||
        (prefs.getStringList(_taskKey)?.isNotEmpty ?? false);
    if (!hasAny) {
      await _plugin.cancel(id: _summaryId);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  List<Map<String, dynamic>> _loadChatHistory(SharedPreferences prefs) {
    final raw = prefs.getString(_chatKey);
    if (raw == null || raw.isEmpty) return <Map<String, dynamic>>[];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is List) {
        return decoded
            .whereType<Map>()
            .map((e) => e.map((k, v) => MapEntry(k.toString(), v)))
            .toList();
      }
    } catch (_) {
      // Historico corrompido: recomeca do zero.
    }
    return <Map<String, dynamic>>[];
  }

  bool _hasChat(SharedPreferences prefs) {
    final raw = prefs.getString(_chatKey);
    return raw != null && raw.isNotEmpty && raw != '[]';
  }
}
