import 'package:flutter/material.dart';

import '../../services/auth_service.dart';
import '../../services/push_service.dart';
import '../../widgets/floating_bottom_nav.dart';
import '../casa/casa_screen.dart';
import '../chat/chat_screen.dart';
import '../contas/contas_screen.dart';
import '../mercado/mercado_screen.dart';
import '../perfil/perfil_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key, required this.authService});

  final AuthService authService;

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _selectedIndex = 0;
  final _pushService = PushService();

  late final List<Widget> _pages;

  @override
  void initState() {
    super.initState();
    final uid = widget.authService.currentUser?.uid;
    if (uid != null) {
      _pushService.initForUser(uid);
    }

    _pages = [
      CasaScreen(authService: widget.authService),
      MercadoScreen(authService: widget.authService),
      ContasScreen(authService: widget.authService),
      ChatScreen(authService: widget.authService),
      PerfilScreen(authService: widget.authService),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final clearance = floatingNavClearance(context);

    // Listas/composer usam padding (inclui a nav).
    // FAB usa FloatingNavFabLocation nas abas (viewPadding do sistema fica intacto).
    final withNavInset = media.copyWith(
      padding: media.padding.copyWith(bottom: clearance),
    );

    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBody: true,
      body: Stack(
        fit: StackFit.expand,
        children: [
          MediaQuery(
            data: withNavInset,
            child: IndexedStack(
              index: _selectedIndex,
              children: _pages,
            ),
          ),
          // Fora do MediaQuery inflado — usa inset real do sistema.
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: FloatingBottomNav(
              selectedIndex: _selectedIndex,
              onDestinationSelected: (index) {
                setState(() => _selectedIndex = index);
              },
            ),
          ),
        ],
      ),
    );
  }
}
