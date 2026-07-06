import 'package:intl/intl.dart';

final _currency = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');

String formatPrice(double value) => _currency.format(value);

/// Aceita "12,50", "12.50", "R$ 1.234,56"...
double parsePrice(String text) {
  var t = text.replaceAll(RegExp(r'[R$\s]'), '');
  if (t.contains(',')) {
    t = t.replaceAll('.', '').replaceAll(',', '.');
  }
  return double.tryParse(t) ?? 0;
}
