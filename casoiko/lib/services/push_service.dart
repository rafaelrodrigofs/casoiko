import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import '../firebase_options.dart';
import 'grouped_notification_manager.dart';
import 'house_service.dart';
import 'notification_service.dart';

/// Handler de mensagens recebidas com o app em background/fechado.
/// Precisa ser uma funcao top-level anotada com vm:entry-point.
///
/// Como as mensagens agora sao data-only, e este handler (num isolate
/// separado) que constroi a notificacao agrupada no dispositivo.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  if (Firebase.apps.isEmpty) {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  }
  await NotificationService.instance.init();
  await GroupedNotificationManager.instance.handleData(message.data);
}

/// Cuida do push entre dispositivos (FCM): token, permissao e recebimento.
class PushService {
  PushService({
    FirebaseMessaging? messaging,
    HouseService? houseService,
  })  : _messaging = messaging ?? FirebaseMessaging.instance,
        _houseService = houseService ?? HouseService();

  final FirebaseMessaging _messaging;
  final HouseService _houseService;

  String? _uid;
  String? _currentToken;

  /// Inicializa o push para o usuario logado [uid].
  Future<void> initForUser(String uid) async {
    _uid = uid;

    await _messaging.requestPermission(alert: true, badge: true, sound: true);

    final token = await _messaging.getToken();
    if (token != null) {
      _currentToken = token;
      await _houseService.saveFcmToken(uid, token);
    }

    _messaging.onTokenRefresh.listen((newToken) {
      _currentToken = newToken;
      _houseService.saveFcmToken(uid, newToken);
    });

    // App em foreground: FCM nao mostra notificacao sozinho no Android.
    // As mensagens sao data-only, entao montamos a notificacao agrupada aqui.
    FirebaseMessaging.onMessage.listen((message) {
      if (message.data.isEmpty) return;
      GroupedNotificationManager.instance.handleData(message.data);
    });
  }

  /// Remove o token do usuario atual (chamar antes do logout).
  Future<void> clearForCurrentUser() async {
    final uid = _uid;
    final token = _currentToken;
    if (uid != null && token != null) {
      await _houseService.removeFcmToken(uid, token);
    }
    _uid = null;
    _currentToken = null;
  }
}
