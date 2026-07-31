import 'package:intl/intl.dart';

final currencyBrl = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
final dateShort = DateFormat('d MMM', 'pt_BR');
final dateFull = DateFormat("EEEE, d 'de' MMMM", 'pt_BR');
final timeHm = DateFormat('HH:mm', 'pt_BR');
final monthYear = DateFormat('MMMM yyyy', 'pt_BR');

String greetingForNow() {
  final h = DateTime.now().hour;
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/// Iniciais a partir do nome completo (ex.: "Natalia Farias" → "NF").
String initialsFromName(String? name, {String fallback = '?'}) {
  final parts = (name ?? '')
      .trim()
      .split(RegExp(r'\s+'))
      .where((p) => p.isNotEmpty)
      .toList();
  if (parts.isEmpty) return fallback;
  if (parts.length == 1) {
    final s = parts.first;
    return s.substring(0, s.length >= 2 ? 2 : 1).toUpperCase();
  }
  return ('${parts.first[0]}${parts.last[0]}').toUpperCase();
}

DateTime startOfDay(DateTime d) => DateTime(d.year, d.month, d.day);

DateTime endOfDay(DateTime d) =>
    DateTime(d.year, d.month, d.day, 23, 59, 59, 999);

DateTime startOfMonth(DateTime d) => DateTime(d.year, d.month, 1);

DateTime endOfMonth(DateTime d) =>
    DateTime(d.year, d.month + 1, 0, 23, 59, 59, 999);
