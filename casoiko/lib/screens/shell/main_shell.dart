import 'package:flutter/material.dart';

import '../../services/auth_service.dart';
import '../casa/casa_screen.dart';
import '../chat/chat_screen.dart';
import '../contas/contas_screen.dart';
import '../mercado/mercado_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key, required this.authService});

  final AuthService authService;

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _selectedIndex = 0;

  late final List<Widget> _pages = [
    CasaScreen(authService: widget.authService),
    MercadoScreen(authService: widget.authService),
    const ContasScreen(),
    ChatScreen(authService: widget.authService),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _selectedIndex,
        children: _pages,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        backgroundColor: Colors.white,
        indicatorColor: const Color(0xFF3D5A4C).withValues(alpha: 0.15),
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
        ],
      ),
    );
  }
}
