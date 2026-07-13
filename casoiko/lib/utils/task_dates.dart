import 'package:flutter/material.dart' show Color;
import 'package:intl/intl.dart';

/// Helpers de data para a aba Casa (navegacao dia/semana).
abstract final class TaskDates {
  static DateTime dateOnly(DateTime date) =>
      DateTime(date.year, date.month, date.day);

  static DateTime get today => dateOnly(DateTime.now());

  static bool isSameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  static bool isToday(DateTime date) => isSameDay(date, today);

  static bool isYesterday(DateTime date) =>
      isSameDay(date, today.subtract(const Duration(days: 1)));

  static bool isTomorrow(DateTime date) =>
      isSameDay(date, today.add(const Duration(days: 1)));

  static bool isFutureDay(DateTime date) => dateOnly(date).isAfter(today);

  static bool isPastDay(DateTime date) => dateOnly(date).isBefore(today);

  /// "Hoje", "Ontem", "Amanha" ou "Ter, 8 jul".
  static String labelFor(DateTime date) {
    if (isToday(date)) return 'Hoje';
    if (isYesterday(date)) return 'Ontem';
    if (isTomorrow(date)) return 'Amanha';
    return DateFormat('EEE, d MMM', 'pt_BR').format(date);
  }

  /// Label curto para a faixa da semana (ex.: "Seg").
  static String weekDayLabel(DateTime date) =>
      DateFormat('EEE', 'pt_BR').format(date);

  static String dayNumber(DateTime date) => '${date.day}';

  static DateTime monthStart(DateTime date) =>
      DateTime(date.year, date.month, 1);

  static bool isSameMonth(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month;

  /// Titulo do mes (ex.: "Julho 2026").
  static String monthTitle(DateTime date) =>
      DateFormat('MMMM yyyy', 'pt_BR').format(date);

  /// Grade 6x7 (seg-dom) cobrindo o mes de [month] e dias adjacentes.
  static List<DateTime> daysForMonthGrid(DateTime month) {
    final first = monthStart(month);
    final gridStart = first.subtract(Duration(days: first.weekday - 1));
    return List.generate(42, (i) => gridStart.add(Duration(days: i)));
  }

  /// Labels curtos seg-dom para cabecalho da grade.
  static const monthWeekdayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  /// Progresso 0..1 para cor da faixa semanal. Retorna -1 se sem tarefas.
  static double progressForDay({
    required int totalTasks,
    required int doneTasks,
  }) {
    if (totalTasks == 0) return -1;
    return doneTasks / totalTasks;
  }

  static Color progressColor(double progress) {
    if (progress < 0) return const Color(0xFF94A3B8);
    if (progress >= 0.9) return const Color(0xFF34D399);
    if (progress >= 0.4) return const Color(0xFFFBBF24);
    return const Color(0xFFF87171);
  }
}
