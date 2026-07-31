import 'package:flutter/material.dart';

import '../../services/auth_service.dart';
import '../../widgets/floating_bottom_nav.dart';
import '../agenda/agenda_screen.dart';
import '../dashboard/dashboard_screen.dart';
import '../financeiro/financeiro_screen.dart';
import '../pacientes/pacientes_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key, required this.authService});

  final AuthService authService;

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _selectedIndex = 0;
  late final List<Widget> _pages;

  @override
  void initState() {
    super.initState();
    _pages = [
      DashboardScreen(authService: widget.authService),
      AgendaScreen(authService: widget.authService),
      PacientesScreen(authService: widget.authService),
      FinanceiroScreen(authService: widget.authService),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final clearance = floatingNavClearance(context);
    final withNavInset = media.copyWith(
      padding: media.padding.copyWith(bottom: clearance),
    );

    return Scaffold(
      backgroundColor: Colors.white,
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
