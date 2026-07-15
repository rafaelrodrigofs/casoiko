import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest_all.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

import '../models/house_task.dart';
import '../models/task_repeat_config.dart';
import '../utils/task_repeat_helper.dart';

/// Cuida dos lembretes locais (agendados no proprio celular, sem servidor).
///
/// Cada tarefa com horario definido vira um alarme local para o morador
/// responsavel. Suporta repeticao diaria e semanal.
class NotificationService {
  NotificationService._();

  static final NotificationService instance = NotificationService._();

  final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  /// Expoe a instancia do plugin para outros servicos (ex.: notificacoes
  /// agrupadas) reusarem a mesma inicializacao, inclusive no isolate de
  /// background.
  FlutterLocalNotificationsPlugin get plugin => _plugin;

  static const String _channelId = 'task_reminders';
  static const String _channelName = 'Lembretes de tarefas';
  static const String _channelDescription =
      'Avisos no horario das tarefas da casa.';

  static const String _pushChannelId = 'casa_updates';
  static const String _pushChannelName = 'Novidades da casa';
  static const String _pushChannelDescription =
      'Mensagens, mercado e tarefas concluidas pela familia.';

  static const String _urgentChannelId = 'urgent_tasks';
  static const String _urgentChannelName = 'Tarefas urgentes';
  static const String _urgentChannelDescription =
      'Alertas em tela cheia para tarefas de prioridade alta.';

  bool _initialized = false;

  Future<void> init() async {
    if (_initialized) return;

    tz_data.initializeTimeZones();
    // App usado no Brasil; fuso fixo evita depender de plugin extra.
    tz.setLocalLocation(tz.getLocation('America/Sao_Paulo'));

    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidSettings);

    await _plugin.initialize(settings: initSettings);

    final androidImpl = _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    await androidImpl?.createNotificationChannel(
      const AndroidNotificationChannel(
        _channelId,
        _channelName,
        description: _channelDescription,
        importance: Importance.high,
      ),
    );
    await androidImpl?.createNotificationChannel(
      const AndroidNotificationChannel(
        _pushChannelId,
        _pushChannelName,
        description: _pushChannelDescription,
        importance: Importance.high,
      ),
    );
    await androidImpl?.createNotificationChannel(
      const AndroidNotificationChannel(
        _urgentChannelId,
        _urgentChannelName,
        description: _urgentChannelDescription,
        importance: Importance.max,
        playSound: true,
      ),
    );

    _initialized = true;
  }

  /// Exibe uma notificacao imediata (usada para mensagens FCM em foreground).
  Future<void> showNow({
    required String title,
    required String body,
    String? payload,
  }) async {
    if (!_initialized) await init();
    await _plugin.show(
      id: DateTime.now().millisecondsSinceEpoch.remainder(100000),
      title: title,
      body: body,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          _pushChannelId,
          _pushChannelName,
          channelDescription: _pushChannelDescription,
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
      ),
      payload: payload,
    );
  }

  /// Pede as permissoes necessarias (notificacao no Android 13+ e alarme exato).
  Future<void> requestPermissions() async {
    final androidImpl = _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    if (androidImpl == null) return;

    await androidImpl.requestNotificationsPermission();
    await androidImpl.requestExactAlarmsPermission();
    await androidImpl.requestFullScreenIntentPermission();
  }

  /// Recalcula todos os lembretes: cancela tudo e reagenda os do usuario atual.
  ///
  /// Regra: agenda tarefas atribuidas ao [currentUid]. Tarefas de prioridade
  /// alta lembram todo mundo da casa.
  Future<void> syncTasks(List<HouseTask> tasks, String currentUid) async {
    if (!_initialized) await init();

    await _plugin.cancelAll();

    for (final task in tasks) {
      final isMine = task.isAssignedTo(currentUid);
      if (!isMine && !task.isHighPriority) continue;
      await _scheduleTask(task);
    }
  }

  Future<void> _scheduleTask(HouseTask task) async {
    if (task.time.isEmpty) return;

    final parts = task.time.split(':');
    if (parts.length < 2) return;
    final hour = int.tryParse(parts[0]);
    final minute = int.tryParse(parts[1]);
    if (hour == null || minute == null) return;

    final details = _detailsFor(task);
    final base = _baseId(task.id);

    if (_usesRecurringComponents(task)) {
      await _scheduleRecurringComponents(task, hour, minute, details, base);
      return;
    }

    final occurrences = TaskRepeatHelper.upcomingOccurrences(
      task,
      limit: 64,
      maxDaysAhead: 90,
    );
    var offset = 0;
    for (final date in occurrences) {
      final scheduled = tz.TZDateTime(
        tz.local,
        date.year,
        date.month,
        date.day,
        hour,
        minute,
      );
      if (scheduled.isBefore(tz.TZDateTime.now(tz.local))) continue;
      await _plugin.zonedSchedule(
        id: base + offset,
        title: task.title,
        body: _bodyFor(task),
        scheduledDate: scheduled,
        notificationDetails: details,
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
      );
      offset++;
    }
  }

  bool _usesRecurringComponents(HouseTask task) {
    if (task.durationType != TaskRepeatConfig.durationForever) return false;
    if (task.repeat == HouseTask.repeatDaily && task.repeatInterval == 1) {
      return true;
    }
    if (task.repeat == HouseTask.repeatWeekly &&
        task.repeatInterval == 1 &&
        task.weekdays.isNotEmpty) {
      return true;
    }
    return false;
  }

  Future<void> _scheduleRecurringComponents(
    HouseTask task,
    int hour,
    int minute,
    NotificationDetails details,
    int base,
  ) async {
    switch (task.repeat) {
      case HouseTask.repeatWeekly:
        final days = task.weekdays.isEmpty
            ? <int>[DateTime.now().weekday]
            : task.weekdays;
        for (final weekday in days) {
          await _plugin.zonedSchedule(
            id: base + weekday,
            title: task.title,
            body: _bodyFor(task),
            scheduledDate: _nextInstanceOfWeekdayTime(weekday, hour, minute),
            notificationDetails: details,
            androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
            matchDateTimeComponents: DateTimeComponents.dayOfWeekAndTime,
          );
        }
        break;
      case HouseTask.repeatDaily:
        await _plugin.zonedSchedule(
          id: base,
          title: task.title,
          body: _bodyFor(task),
          scheduledDate: _nextInstanceOfTime(hour, minute),
          notificationDetails: details,
          androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
          matchDateTimeComponents: DateTimeComponents.time,
        );
        break;
      case HouseTask.repeatNone:
      default:
        await _plugin.zonedSchedule(
          id: base,
          title: task.title,
          body: _bodyFor(task),
          scheduledDate: _nextInstanceOfTime(hour, minute),
          notificationDetails: details,
          androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
        );
        break;
    }
  }

  Future<void> cancelTask(String taskId) async {
    final base = _baseId(taskId);
    await _plugin.cancel(id: base);
    for (var i = 1; i <= 70; i++) {
      await _plugin.cancel(id: base + i);
    }
  }

  NotificationDetails _detailsFor(HouseTask task) {
    // Tarefas de prioridade alta disparam alerta em tela cheia estilo alarme,
    // aparecendo por cima de tudo mesmo com o celular bloqueado.
    if (task.isHighPriority) {
      return const NotificationDetails(
        android: AndroidNotificationDetails(
          _urgentChannelId,
          _urgentChannelName,
          channelDescription: _urgentChannelDescription,
          importance: Importance.max,
          priority: Priority.max,
          category: AndroidNotificationCategory.alarm,
          fullScreenIntent: true,
          icon: '@mipmap/ic_launcher',
        ),
      );
    }
    return const NotificationDetails(
      android: AndroidNotificationDetails(
        _channelId,
        _channelName,
        channelDescription: _channelDescription,
        importance: Importance.high,
        priority: Priority.high,
        category: AndroidNotificationCategory.reminder,
        icon: '@mipmap/ic_launcher',
      ),
    );
  }

  String _bodyFor(HouseTask task) {
    final who = task.assigneeShortLabel;
    if (task.description.isNotEmpty) return task.description;
    return 'Tarefa de $who no horario ${task.time}.';
  }

  /// Gera um id numerico estavel a partir do id (string) da tarefa.
  /// Deixa espaco para offsets de dia da semana (+1..+7).
  int _baseId(String taskId) {
    final positive = taskId.hashCode & 0x7fffffff;
    return (positive % 100000000) * 10;
  }

  tz.TZDateTime _nextInstanceOfTime(int hour, int minute) {
    final now = tz.TZDateTime.now(tz.local);
    var scheduled =
        tz.TZDateTime(tz.local, now.year, now.month, now.day, hour, minute);
    if (scheduled.isBefore(now)) {
      scheduled = scheduled.add(const Duration(days: 1));
    }
    return scheduled;
  }

  tz.TZDateTime _nextInstanceOfWeekdayTime(int weekday, int hour, int minute) {
    var scheduled = _nextInstanceOfTime(hour, minute);
    while (scheduled.weekday != weekday) {
      scheduled = scheduled.add(const Duration(days: 1));
    }
    return scheduled;
  }

  @visibleForTesting
  int debugBaseId(String taskId) => _baseId(taskId);
}
