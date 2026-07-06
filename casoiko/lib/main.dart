import 'package:firebase_core/firebase_core.dart';

import 'package:flutter/material.dart';

import 'package:flutter/services.dart';



import 'firebase_options.dart';

import 'screens/login_screen.dart';

import 'screens/shell/main_shell.dart';

import 'services/auth_service.dart';

import 'services/settings_service.dart';

import 'theme/app_theme.dart';



Future<void> main() async {

  WidgetsFlutterBinding.ensureInitialized();



  await Firebase.initializeApp(

    options: DefaultFirebaseOptions.currentPlatform,

  );



  final authService = AuthService();

  await authService.initialize();



  final settingsService = SettingsService();

  await settingsService.load();



  runApp(CasoikoApp(

    authService: authService,

    settingsService: settingsService,

  ));

}



class CasoikoApp extends StatelessWidget {

  const CasoikoApp({

    super.key,

    required this.authService,

    required this.settingsService,

  });



  final AuthService authService;

  final SettingsService settingsService;



  @override

  Widget build(BuildContext context) {

    return ListenableBuilder(

      listenable: settingsService,

      builder: (context, _) {

        return MaterialApp(

          title: 'Casoiko',

          debugShowCheckedModeBanner: false,

          theme: AppTheme.light,

          darkTheme: AppTheme.dark,

          themeMode: settingsService.themeMode,

          builder: (context, child) {

            final isDark = Theme.of(context).brightness == Brightness.dark;

            final navBarColor = Theme.of(context).colorScheme.surface;



            return AnnotatedRegion<SystemUiOverlayStyle>(

              value: SystemUiOverlayStyle(

                systemNavigationBarColor: navBarColor,

                systemNavigationBarIconBrightness:

                    isDark ? Brightness.light : Brightness.dark,

                systemNavigationBarContrastEnforced: false,

              ),

              child: child!,

            );

          },

          home: StreamBuilder(

            stream: authService.authStateChanges,

            builder: (context, snapshot) {

              if (snapshot.connectionState == ConnectionState.waiting) {

                return const Scaffold(

                  body: Center(child: CircularProgressIndicator()),

                );

              }



              if (snapshot.hasData) {

                return MainShell(

                  authService: authService,

                  settingsService: settingsService,

                );

              }



              return LoginScreen(authService: authService);

            },

          ),

        );

      },

    );

  }

}

