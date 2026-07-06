import 'package:flutter/material.dart';

/// Ícones Material usados no lugar de emojis em todo o app.
abstract final class AppIcons {
  static const defaultList = Icons.shopping_cart_outlined;
  static const defaultCategory = Icons.inventory_2_outlined;

  /// Ícones para escolher ao criar uma lista de compras.
  static const listPicker = [
    Icons.shopping_cart_outlined,
    Icons.eco_outlined,
    Icons.local_pharmacy_outlined,
    Icons.pets_outlined,
    Icons.build_outlined,
    Icons.celebration_outlined,
    Icons.outdoor_grill_outlined,
    Icons.beach_access_outlined,
  ];

  static const _categoryByName = <String, IconData>{
    'Hortifruti': Icons.eco_outlined,
    'Carnes e Frios': Icons.set_meal_outlined,
    'Laticínios': Icons.icecream_outlined,
    'Padaria': Icons.bakery_dining_outlined,
    'Mercearia': Icons.soup_kitchen_outlined,
    'Bebidas': Icons.local_drink_outlined,
    'Limpeza': Icons.cleaning_services_outlined,
    'Higiene': Icons.sanitizer_outlined,
    'Outros': Icons.inventory_2_outlined,
  };

  static const _legacyEmoji = <String, IconData>{
    '🥬': Icons.eco_outlined,
    '🥩': Icons.set_meal_outlined,
    '🧀': Icons.icecream_outlined,
    '🍞': Icons.bakery_dining_outlined,
    '🥫': Icons.soup_kitchen_outlined,
    '🥤': Icons.local_drink_outlined,
    '🧴': Icons.cleaning_services_outlined,
    '🧻': Icons.sanitizer_outlined,
    '📦': Icons.inventory_2_outlined,
    '🛒': Icons.shopping_cart_outlined,
    '💊': Icons.local_pharmacy_outlined,
    '🐶': Icons.pets_outlined,
    '🧰': Icons.build_outlined,
    '🎉': Icons.celebration_outlined,
    '🍖': Icons.outdoor_grill_outlined,
    '🏖️': Icons.beach_access_outlined,
    '🏷️': Icons.label_outline,
    '🏠': Icons.home_outlined,
    '⚡': Icons.bolt_outlined,
    '🚗': Icons.directions_car_outlined,
    '📺': Icons.subscriptions_outlined,
    '🔧': Icons.handyman_outlined,
    '💰': Icons.payments_outlined,
    '💵': Icons.attach_money,
  };

  static IconData fromCode(int? code, {IconData fallback = defaultCategory}) {
    if (code == null) return fallback;
    // codePoint vem do Firestore — não pode ser const em tempo de compilação.
    // ignore: non_const_argument_for_const_parameter
    return IconData(code, fontFamily: 'MaterialIcons');
  }

  static int codeForCategoryName(String name) {
    return (_categoryByName[name] ?? defaultCategory).codePoint;
  }

  static int? legacyEmojiToCode(String? emoji) {
    if (emoji == null || emoji.isEmpty) return null;
    return _legacyEmoji[emoji]?.codePoint;
  }

  static int resolveIconCode({
    int? iconCode,
    String? legacyEmoji,
    String? name,
    IconData fallback = defaultCategory,
  }) {
    if (iconCode != null) return iconCode;
    final fromEmoji = legacyEmojiToCode(legacyEmoji);
    if (fromEmoji != null) return fromEmoji;
    if (name != null && _categoryByName.containsKey(name)) {
      return codeForCategoryName(name);
    }
    return fallback.codePoint;
  }

  /// Remove emoji legado do início de strings salvas no Firestore.
  static String stripLegacyPrefix(String value) {
    final trimmed = value.trim();
    for (final emoji in _legacyEmoji.keys) {
      if (trimmed.startsWith(emoji)) {
        return trimmed.substring(emoji.length).trim();
      }
    }
    return trimmed;
  }
}

/// Categoria financeira com ícone Material.
class FinanceCategory {
  const FinanceCategory(this.name, this.icon);

  final String name;
  final IconData icon;
}

const kExpenseCategories = [
  FinanceCategory('Moradia', Icons.home_outlined),
  FinanceCategory('Utilidades', Icons.bolt_outlined),
  FinanceCategory('Alimentação', Icons.shopping_cart_outlined),
  FinanceCategory('Transporte', Icons.directions_car_outlined),
  FinanceCategory('Saúde', Icons.local_pharmacy_outlined),
  FinanceCategory('Assinaturas', Icons.subscriptions_outlined),
  FinanceCategory('Manutenção', Icons.handyman_outlined),
  FinanceCategory('Lazer', Icons.celebration_outlined),
  FinanceCategory('Outros', Icons.inventory_2_outlined),
];

const kIncomeCategories = [
  FinanceCategory('Salário', Icons.payments_outlined),
  FinanceCategory('Extra', Icons.attach_money),
  FinanceCategory('Outros', Icons.inventory_2_outlined),
];

IconData financeIconFor(String storedCategory) {
  final name = AppIcons.stripLegacyPrefix(storedCategory);
  for (final category in [...kExpenseCategories, ...kIncomeCategories]) {
    if (category.name == name) return category.icon;
  }
  return AppIcons.defaultCategory;
}

String financeCategoryName(String storedCategory) {
  return AppIcons.stripLegacyPrefix(storedCategory);
}

/// Resolve categoria salva (com ou sem emoji legado) para o nome canônico.
String resolveFinanceCategory(String stored) {
  final name = financeCategoryName(stored);
  for (final category in [...kExpenseCategories, ...kIncomeCategories]) {
    if (category.name == name) return category.name;
  }
  return kExpenseCategories.last.name;
}
