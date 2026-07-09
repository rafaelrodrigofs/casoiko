import '../models/house_task.dart';
import '../models/task_repeat_config.dart';

/// Lógica de visibilidade e ocorrências de tarefas repetidas.
abstract final class TaskRepeatHelper {
  /// Tarefa aparece na lista do dia [date].
  static bool matchesOn(HouseTask task, DateTime date) {
    if (!_isOnOrAfterCreated(task, date)) return false;
    if (!_matchesPattern(task, date)) return false;
    if (!_withinDuration(task, date)) return false;
    return true;
  }

  /// Próximas ocorrências a partir de [from] (inclusive), até [limit] itens.
  static List<DateTime> upcomingOccurrences(
    HouseTask task, {
    DateTime? from,
    int limit = 90,
    int maxDaysAhead = 365,
  }) {
    final start = _dateOnly(from ?? DateTime.now());
    final end = start.add(Duration(days: maxDaysAhead));
    final results = <DateTime>[];

    var cursor = start;
    while (!cursor.isAfter(end) && results.length < limit) {
      if (matchesOn(task, cursor)) {
        results.add(cursor);
      }
      cursor = cursor.add(const Duration(days: 1));
    }
    return results;
  }

  static bool _isOnOrAfterCreated(HouseTask task, DateTime date) {
    return HouseTask.dateKeyFor(date)
            .compareTo(HouseTask.dateKeyFor(task.createdAt)) >=
        0;
  }

  static bool _matchesPattern(HouseTask task, DateTime date) {
    final interval = task.repeatInterval.clamp(1, 999);
    final created = _dateOnly(task.createdAt);

    switch (task.repeat) {
      case HouseTask.repeatNone:
        return HouseTask.dateKeyFor(date) == HouseTask.dateKeyFor(task.createdAt);

      case HouseTask.repeatDaily:
        final daysSince = _daysBetween(created, date);
        return daysSince % interval == 0;

      case HouseTask.repeatWeekly:
        final days = task.weekdays.isEmpty ? [date.weekday] : task.weekdays;
        if (!days.contains(date.weekday)) return false;
        final periodIndex = _weekPeriodIndex(created, date, interval);
        return periodIndex >= 0;

      case HouseTask.repeatMonthly:
        final monthDays = task.monthDays.isEmpty ? [created.day] : task.monthDays;
        if (!monthDays.contains(date.day)) return false;
        final periodIndex = _monthPeriodIndex(created, date, interval);
        return periodIndex >= 0;

      case HouseTask.repeatYearly:
        final months = task.yearMonths.isEmpty ? [created.month] : task.yearMonths;
        final monthDays = task.monthDays.isEmpty ? [created.day] : task.monthDays;
        if (!months.contains(date.month) || !monthDays.contains(date.day)) {
          return false;
        }
        final periodIndex = _yearPeriodIndex(created, date, interval);
        return periodIndex >= 0;

      default:
        return false;
    }
  }

  static bool _withinDuration(HouseTask task, DateTime date) {
    switch (task.durationType) {
      case TaskRepeatConfig.durationTypeUntil:
        final until = task.durationUntil;
        if (until == null) return true;
        return HouseTask.dateKeyFor(date)
                .compareTo(HouseTask.dateKeyFor(until)) <=
            0;

      case TaskRepeatConfig.durationTypeCount:
        final maxCycles = task.durationCount;
        if (maxCycles == null || maxCycles <= 0) return true;
        final periodIndex = _periodIndexAt(task, date);
        return periodIndex >= 0 && periodIndex < maxCycles;

      case TaskRepeatConfig.durationForever:
      default:
        return true;
    }
  }

  static int _periodIndexAt(HouseTask task, DateTime date) {
    final interval = task.repeatInterval.clamp(1, 999);
    final created = _dateOnly(task.createdAt);

    switch (task.repeat) {
      case HouseTask.repeatDaily:
        return _daysBetween(created, date) ~/ interval;
      case HouseTask.repeatWeekly:
        return _weekPeriodIndex(created, date, interval);
      case HouseTask.repeatMonthly:
        return _monthPeriodIndex(created, date, interval);
      case HouseTask.repeatYearly:
        return _yearPeriodIndex(created, date, interval);
      default:
        return 0;
    }
  }

  static int _weekPeriodIndex(DateTime created, DateTime date, int interval) {
    final createdWeekStart = _weekStartMonday(created);
    final dateWeekStart = _weekStartMonday(date);
    final weeksSince = _daysBetween(createdWeekStart, dateWeekStart) ~/ 7;
    if (weeksSince < 0) return -1;
    if (weeksSince % interval != 0) return -1;
    return weeksSince ~/ interval;
  }

  static int _monthPeriodIndex(DateTime created, DateTime date, int interval) {
    final monthsSince = _monthsBetween(created, date);
    if (monthsSince < 0) return -1;
    if (monthsSince % interval != 0) return -1;
    return monthsSince ~/ interval;
  }

  static int _yearPeriodIndex(DateTime created, DateTime date, int interval) {
    final yearsSince = date.year - created.year;
    if (yearsSince < 0) return -1;
    if (yearsSince % interval != 0) return -1;
    return yearsSince ~/ interval;
  }

  static DateTime _dateOnly(DateTime d) =>
      DateTime(d.year, d.month, d.day);

  static DateTime _weekStartMonday(DateTime d) {
    final date = _dateOnly(d);
    return date.subtract(Duration(days: date.weekday - 1));
  }

  static int _daysBetween(DateTime from, DateTime to) {
    return to.difference(from).inDays;
  }

  static int _monthsBetween(DateTime from, DateTime to) {
    return (to.year - from.year) * 12 + (to.month - from.month);
  }
}
