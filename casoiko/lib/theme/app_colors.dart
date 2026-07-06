import 'package:flutter/material.dart';

/// Paleta do Casoiko — adapta ao tema claro ou escuro via [ThemeExtension].
@immutable
class CasoikoColors extends ThemeExtension<CasoikoColors> {
  const CasoikoColors({
    required this.background,
    required this.surface,
    required this.surfaceMuted,
    required this.primary,
    required this.primarySoft,
    required this.textPrimary,
    required this.textSecondary,
    required this.border,
    required this.success,
    required this.danger,
    required this.warning,
  });

  final Color background;
  final Color surface;
  final Color surfaceMuted;
  final Color primary;
  final Color primarySoft;
  final Color textPrimary;
  final Color textSecondary;
  final Color border;
  final Color success;
  final Color danger;
  final Color warning;

  static const light = CasoikoColors(
    background: Color(0xFFF6F7F9),
    surface: Color(0xFFFFFFFF),
    surfaceMuted: Color(0xFFF0F2F5),
    primary: Color(0xFF1B6B54),
    primarySoft: Color(0xFFE8F3EF),
    textPrimary: Color(0xFF1A1D21),
    textSecondary: Color(0xFF6B7280),
    border: Color(0xFFE5E7EB),
    success: Color(0xFF16A34A),
    danger: Color(0xFFDC2626),
    warning: Color(0xFFD97706),
  );

  static const dark = CasoikoColors(
    background: Color(0xFF0F1114),
    surface: Color(0xFF1A1D21),
    surfaceMuted: Color(0xFF252A30),
    primary: Color(0xFF3CB896),
    primarySoft: Color(0xFF1B3D32),
    textPrimary: Color(0xFFF3F4F6),
    textSecondary: Color(0xFF9CA3AF),
    border: Color(0xFF2D333B),
    success: Color(0xFF4ADE80),
    danger: Color(0xFFF87171),
    warning: Color(0xFFFBBF24),
  );

  @override
  CasoikoColors copyWith({
    Color? background,
    Color? surface,
    Color? surfaceMuted,
    Color? primary,
    Color? primarySoft,
    Color? textPrimary,
    Color? textSecondary,
    Color? border,
    Color? success,
    Color? danger,
    Color? warning,
  }) {
    return CasoikoColors(
      background: background ?? this.background,
      surface: surface ?? this.surface,
      surfaceMuted: surfaceMuted ?? this.surfaceMuted,
      primary: primary ?? this.primary,
      primarySoft: primarySoft ?? this.primarySoft,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      border: border ?? this.border,
      success: success ?? this.success,
      danger: danger ?? this.danger,
      warning: warning ?? this.warning,
    );
  }

  @override
  CasoikoColors lerp(ThemeExtension<CasoikoColors>? other, double t) {
    if (other is! CasoikoColors) return this;
    return CasoikoColors(
      background: Color.lerp(background, other.background, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceMuted: Color.lerp(surfaceMuted, other.surfaceMuted, t)!,
      primary: Color.lerp(primary, other.primary, t)!,
      primarySoft: Color.lerp(primarySoft, other.primarySoft, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      border: Color.lerp(border, other.border, t)!,
      success: Color.lerp(success, other.success, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
    );
  }
}

extension CasoikoColorsX on BuildContext {
  CasoikoColors get appColors =>
      Theme.of(this).extension<CasoikoColors>() ?? CasoikoColors.light;
}

/// Alias legado — prefira [BuildContext.appColors] nas telas.
abstract final class AppColors {
  static const background = Color(0xFFF6F7F9);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceMuted = Color(0xFFF0F2F5);
  static const primary = Color(0xFF1B6B54);
  static const primarySoft = Color(0xFFE8F3EF);
  static const textPrimary = Color(0xFF1A1D21);
  static const textSecondary = Color(0xFF6B7280);
  static const border = Color(0xFFE5E7EB);
  static const success = Color(0xFF16A34A);
  static const danger = Color(0xFFDC2626);
  static const warning = Color(0xFFD97706);
}
