import 'package:flutter/material.dart';

import '../../services/auth_service.dart';
import '../../services/settings_service.dart';
import '../casa/casa_screen.dart';
import '../chat/chat_screen.dart';
import '../contas/contas_screen.dart';
import '../mercado/mercado_screen.dart';
import '../settings/settings_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({
    super.key,
    required this.authService,
    required this.settingsService,
  });

  final AuthService authService;
  final SettingsService settingsService;

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _selectedIndex = 0;

  static const _settingsTabIndex = 4;

  void _openSettings() => setState(() => _selectedIndex = _settingsTabIndex);

  @override
  Widget build(BuildContext context) {
    final pages = [
      CasaScreen(
        authService: widget.authService,
        onOpenSettings: _openSettings,
      ),
      MercadoScreen(authService: widget.authService),
      ContasScreen(authService: widget.authService),
      ChatScreen(authService: widget.authService),
      SettingsScreen(
        authService: widget.authService,
        settingsService: widget.settingsService,
      ),
    ];

    return Scaffold(
      body: IndexedStack(
        index: _selectedIndex,
        children: pages,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (index) {
          setState(() => _selectedIndex = index);
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Casa',
          ),
          NavigationDestination(
            icon: Icon(Icons.shopping_cart_outlined),
            selectedIcon: Icon(Icons.shopping_cart),
            label: 'Mercado',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'Contas',
          ),
          NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline),
            selectedIcon: Icon(Icons.chat_bubble),
            label: 'Chat',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: 'Config',
          ),
        ],
      ),
    );
  }
}
