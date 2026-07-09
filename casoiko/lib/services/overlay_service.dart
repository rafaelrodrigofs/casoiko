import 'package:flutter_overlay_window/flutter_overlay_window.dart';

/// Cuida da bolha flutuante (sobreposicao por cima de outros apps).
class OverlayService {
  OverlayService._();

  static final OverlayService instance = OverlayService._();

  /// Garante a permissao de "sobrepor a outros apps".
  /// Abre a tela do sistema se ainda nao estiver concedida.
  Future<bool> ensurePermission() async {
    final granted = await FlutterOverlayWindow.isPermissionGranted();
    if (granted) return true;
    final result = await FlutterOverlayWindow.requestPermission();
    return result ?? false;
  }

  /// Mostra ou atualiza a bolha com a quantidade de tarefas pendentes.
  /// Sem permissao, nao faz nada. Com zero pendencias, esconde a bolha.
  Future<void> syncPending(int pending) async {
    final granted = await FlutterOverlayWindow.isPermissionGranted();
    if (!granted) return;

    if (pending <= 0) {
      if (await FlutterOverlayWindow.isActive()) {
        await FlutterOverlayWindow.closeOverlay();
      }
      return;
    }

    if (!await FlutterOverlayWindow.isActive()) {
      await FlutterOverlayWindow.showOverlay(
        height: 180,
        width: 180,
        alignment: OverlayAlignment.centerRight,
        flag: OverlayFlag.defaultFlag,
        enableDrag: true,
        positionGravity: PositionGravity.auto,
        overlayTitle: 'Casoiko',
        overlayContent: 'Tarefas pendentes na casa',
      );
      // Pequena espera para o isolate do overlay iniciar antes de enviar dados.
      await Future.delayed(const Duration(milliseconds: 400));
    }

    await FlutterOverlayWindow.shareData(pending);
  }

  Future<void> hide() async {
    if (await FlutterOverlayWindow.isActive()) {
      await FlutterOverlayWindow.closeOverlay();
    }
  }
}
