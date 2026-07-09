import 'package:intl/intl.dart';

import 'house_task.dart';

/// Configuração completa de repetição de uma tarefa.
class TaskRepeatConfig {
  const TaskRepeatConfig({
    this.type = HouseTask.repeatNone,
    this.interval = 1,
    this.weekdays = const [],
    this.monthDays = const [],
    this.yearMonths = const [],
    this.durationType = durationForever,
    this.durationCount,
    this.durationUntil,
  });

  static const durationForever = 'forever';
  static const durationTypeCount = 'count';
  static const durationTypeUntil = 'until';

  final String type;
  final int interval;
  final List<int> weekdays;
  final List<int> monthDays;
  final List<int> yearMonths;
  final String durationType;
  final int? durationCount;
  final DateTime? durationUntil;

  bool get repeats => type != HouseTask.repeatNone;

  TaskRepeatConfig copyWith({
    String? type,
    int? interval,
    List<int>? weekdays,
    List<int>? monthDays,
    List<int>? yearMonths,
    String? durationType,
    int? durationCount,
    DateTime? durationUntil,
    bool clearDurationCount = false,
    bool clearDurationUntil = false,
  }) {
    return TaskRepeatConfig(
      type: type ?? this.type,
      interval: interval ?? this.interval,
      weekdays: weekdays ?? this.weekdays,
      monthDays: monthDays ?? this.monthDays,
      yearMonths: yearMonths ?? this.yearMonths,
      durationType: durationType ?? this.durationType,
      durationCount:
          clearDurationCount ? null : (durationCount ?? this.durationCount),
      durationUntil:
          clearDurationUntil ? null : (durationUntil ?? this.durationUntil),
    );
  }

  factory TaskRepeatConfig.fromHouseTask(HouseTask task) {
    return TaskRepeatConfig(
      type: task.repeat,
      interval: task.repeatInterval,
      weekdays: List<int>.from(task.weekdays),
      monthDays: List<int>.from(task.monthDays),
      yearMonths: List<int>.from(task.yearMonths),
      durationType: task.durationType,
      durationCount: task.durationCount,
      durationUntil: task.durationUntil,
    );
  }

  factory TaskRepeatConfig.fromFirestoreMap(Map<String, dynamic> data) {
    final untilStr = data['duration_until'] as String?;
    return TaskRepeatConfig(
      type: data['repeat'] as String? ?? HouseTask.repeatNone,
      interval: (data['repeat_interval'] as num?)?.toInt() ?? 1,
      weekdays: _intList(data['weekdays']),
      monthDays: _intList(data['month_days']),
      yearMonths: _intList(data['year_months']),
      durationType: data['duration_type'] as String? ?? durationForever,
      durationCount: (data['duration_count'] as num?)?.toInt(),
      durationUntil: untilStr != null && untilStr.isNotEmpty
          ? DateTime.tryParse(untilStr)
          : null,
    );
  }

  Map<String, dynamic> toFirestoreMap() => {
        'repeat': type,
        'repeat_interval': interval.clamp(1, 999),
        'weekdays': weekdays,
        'month_days': monthDays,
        'year_months': yearMonths,
        'duration_type': durationType,
        if (durationType == durationTypeCount && durationCount != null)
          'duration_count': durationCount,
        if (durationType == durationTypeUntil && durationUntil != null)
          'duration_until': HouseTask.dateKeyFor(durationUntil!),
      };

  /// Texto curto para o botão no formulário.
  String summaryShort() {
    if (type == HouseTask.repeatNone) return 'Uma vez';

    final n = interval;
    switch (type) {
      case HouseTask.repeatDaily:
        return n == 1 ? 'Diária' : 'A cada $n dias';
      case HouseTask.repeatWeekly:
        final days = _weekdayNames(weekdays);
        final base = n == 1 ? 'Semanal' : 'A cada $n semanas';
        return days.isEmpty ? base : '$base ($days)';
      case HouseTask.repeatMonthly:
        final days = _joinInts(monthDays);
        final base = n == 1 ? 'Mensal' : 'A cada $n meses';
        return days.isEmpty ? base : '$base (dia $days)';
      case HouseTask.repeatYearly:
        final months = _monthAbbrevs(yearMonths);
        final days = _joinInts(monthDays);
        final base = n == 1 ? 'Anual' : 'A cada $n anos';
        if (months.isEmpty && days.isEmpty) return base;
        if (days.isEmpty) return '$base ($months)';
        if (months.isEmpty) return '$base (dia $days)';
        return '$base ($months, dia $days)';
      default:
        return 'Uma vez';
    }
  }

  /// Frase descritiva no topo do modal.
  String summarySentence({DateTime? anchor}) {
    if (type == HouseTask.repeatNone) {
      return 'Esta tarefa não se repetirá.';
    }

    final buffer = StringBuffer('Esta tarefa se repetirá ');
    final n = interval;

    switch (type) {
      case HouseTask.repeatDaily:
        if (n == 1) {
          buffer.write('todos os dias');
        } else {
          buffer.write('a cada $n dias');
        }
        break;
      case HouseTask.repeatWeekly:
        final names = _weekdayFullNames(weekdays);
        if (n == 1) {
          if (names.length == 1) {
            buffer.write('toda $names');
          } else if (names.isNotEmpty) {
            buffer.write('toda $names');
          } else {
            buffer.write('toda semana');
          }
        } else {
          buffer.write('a cada $n semanas');
          if (names.isNotEmpty) buffer.write(' ($names)');
        }
        break;
      case HouseTask.repeatMonthly:
        final days = _joinInts(monthDays);
        if (n == 1) {
          if (days.isNotEmpty) {
            buffer.write('nos dias $days de cada mês');
          } else {
            buffer.write('todo mês');
          }
        } else {
          buffer.write('a cada $n meses');
          if (days.isNotEmpty) buffer.write(' nos dias $days');
        }
        break;
      case HouseTask.repeatYearly:
        final months = _monthAbbrevs(yearMonths);
        final days = _joinInts(monthDays);
        if (n == 1) {
          if (months.isNotEmpty && days.isNotEmpty) {
            buffer.write('em $months nos dias $days');
          } else if (months.isNotEmpty) {
            buffer.write('em $months');
          } else if (days.isNotEmpty) {
            buffer.write('nos dias $days de cada ano');
          } else {
            buffer.write('todo ano');
          }
        } else {
          buffer.write('a cada $n anos');
          if (months.isNotEmpty) buffer.write(' em $months');
          if (days.isNotEmpty) buffer.write(' nos dias $days');
        }
        break;
    }

    buffer.write(_durationSuffix());
    buffer.write('.');
    return buffer.toString();
  }

  String _durationSuffix() {
    switch (durationType) {
      case durationTypeCount:
        final c = durationCount ?? 1;
        return ', por $c ${_cycleLabel(c)}';
      case durationTypeUntil:
        if (durationUntil == null) return '';
        final fmt = DateFormat("d 'de' MMM 'de' y", 'pt_BR');
        return ', até ${fmt.format(durationUntil!)}';
      default:
        return '';
    }
  }

  String _cycleLabel(int count) {
    switch (type) {
      case HouseTask.repeatDaily:
        return count == 1 ? 'ciclo' : 'ciclos';
      case HouseTask.repeatWeekly:
        return count == 1 ? 'semana' : 'semanas';
      case HouseTask.repeatMonthly:
        return count == 1 ? 'mês' : 'meses';
      case HouseTask.repeatYearly:
        return count == 1 ? 'ano' : 'anos';
      default:
        return count == 1 ? 'vez' : 'vezes';
    }
  }

  static List<int> _intList(dynamic raw) {
    return (raw as List<dynamic>? ?? [])
        .map((e) => (e as num).toInt())
        .toList();
  }

  static String _joinInts(List<int> values) {
    if (values.isEmpty) return '';
    final sorted = [...values]..sort();
    if (sorted.length == 1) return '${sorted.first}';
    if (sorted.length == 2) return '${sorted[0]} e ${sorted[1]}';
    final last = sorted.removeLast();
    return '${sorted.join(', ')} e $last';
  }

  static String _weekdayNames(List<int> days) {
    if (days.isEmpty) return '';
    const short = {1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sáb', 7: 'dom'};
    return days.map((d) => short[d] ?? '').where((s) => s.isNotEmpty).join(', ');
  }

  static String _weekdayFullNames(List<int> days) {
    if (days.isEmpty) return '';
    const names = {
      1: 'segunda-feira',
      2: 'terça-feira',
      3: 'quarta-feira',
      4: 'quinta-feira',
      5: 'sexta-feira',
      6: 'sábado',
      7: 'domingo',
    };
    final list = days.map((d) => names[d] ?? '').where((s) => s.isNotEmpty).toList();
    if (list.length == 1) return list.first;
    if (list.length == 2) return '${list[0]} e ${list[1]}';
    final last = list.removeLast();
    return '${list.join(', ')} e $last';
  }

  static String _monthAbbrevs(List<int> months) {
    if (months.isEmpty) return '';
    const abbr = {
      1: 'jan.', 2: 'fev.', 3: 'mar.', 4: 'abr.',
      5: 'mai.', 6: 'jun.', 7: 'jul.', 8: 'ago.',
      9: 'set.', 10: 'out.', 11: 'nov.', 12: 'dez.',
    };
    return months.map((m) => abbr[m] ?? '').where((s) => s.isNotEmpty).join(', ');
  }
}
