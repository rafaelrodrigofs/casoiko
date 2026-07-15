import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Estilos de status / navigation bar do Android (e iOS).
///
/// Separados porque [SystemUiOverlayStyle.light] também clareia os ícones
/// da navbar do sistema — quebrando o contraste sobre fundo branco.
abstract final class AppSystemUi {
  /// Header azul/gradiente: status claro; navbar do Android sempre escura.
  static const darkHeader = SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    statusBarBrightness: Brightness.dark,
    systemNavigationBarColor: Colors.white,
    systemNavigationBarIconBrightness: Brightness.dark,
    systemNavigationBarContrastEnforced: false,
  );

  /// Superfície clara: status e navbar escuros.
  static const lightSurface = SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    statusBarBrightness: Brightness.light,
    systemNavigationBarColor: Colors.white,
    systemNavigationBarIconBrightness: Brightness.dark,
    systemNavigationBarContrastEnforced: false,
  );
}
