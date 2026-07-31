import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'firebase_options.dart';
import 'screens/login/login_screen.dart';
import 'screens/shell/main_shell.dart';
import 'services/auth_service.dart';
import 'theme/app_system_ui.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(AppSystemUi.lightSurface);

  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  await initializeDateFormatting('pt_BR', null);

  final authService = AuthService();
  await authService.initialize();

  runApp(NatiPsicoApp(authService: authService));
}

class NatiPsicoApp extends StatelessWidget {
  const NatiPsicoApp({super.key, required this.authService});

  final AuthService authService;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'NatiPsico',
      debugShowCheckedModeBanner: false,
      locale: const Locale('pt', 'BR'),
      supportedLocales: const [Locale('pt', 'BR')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) {
        return AnnotatedRegion<SystemUiOverlayStyle>(
          value: AppSystemUi.lightSurface,
          child: child!,
        );
      },
      theme: AppTheme.light,
      home: StreamBuilder(
        stream: authService.authStateChanges,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }
          if (snapshot.hasData) {
            return MainShell(authService: authService);
          }
          return LoginScreen(authService: authService);
        },
      ),
    );
  }
}
