import 'package:flutter/material.dart';
import 'package:natipsico/theme/app_colors.dart';

const kFloatingNavMargin = 16.0;
const kFloatingNavBarHeight = 64.0;

double floatingNavClearance(BuildContext context) {
  return kFloatingNavMargin +
      kFloatingNavBarHeight +
      MediaQuery.viewPaddingOf(context).bottom;
}

class FloatingBottomNav extends StatelessWidget {
  const FloatingBottomNav({
    super.key,
    required this.selectedIndex,
    required this.onDestinationSelected,
  });

  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;

  static const _destinations = [
    _NavItem(
      label: 'Início',
      icon: Icons.home_outlined,
      selectedIcon: Icons.home_rounded,
    ),
    _NavItem(
      label: 'Agenda',
      icon: Icons.calendar_today_outlined,
      selectedIcon: Icons.calendar_today,
    ),
    _NavItem(
      label: 'Pacientes',
      icon: Icons.people_outline,
      selectedIcon: Icons.people,
    ),
    _NavItem(
      label: 'Financeiro',
      icon: Icons.account_balance_wallet_outlined,
      selectedIcon: Icons.account_balance_wallet,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(
        kFloatingNavMargin,
        0,
        kFloatingNavMargin,
        kFloatingNavMargin + bottom,
      ),
      child: Material(
        color: AppColors.surface,
        elevation: 8,
        shadowColor: Colors.black26,
        borderRadius: BorderRadius.circular(28),
        child: Container(
          height: kFloatingNavBarHeight,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: List.generate(_destinations.length, (i) {
              final item = _destinations[i];
              final selected = i == selectedIndex;
              return Expanded(
                child: InkWell(
                  borderRadius: BorderRadius.circular(28),
                  onTap: () => onDestinationSelected(i),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        selected ? item.selectedIcon : item.icon,
                        size: 22,
                        color: selected
                            ? AppColors.primary
                            : AppColors.textMuted,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        item.label,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight:
                              selected ? FontWeight.w700 : FontWeight.w500,
                          color: selected
                              ? AppColors.primary
                              : AppColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}

class _NavItem {
  const _NavItem({
    required this.label,
    required this.icon,
    required this.selectedIcon,
  });

  final String label;
  final IconData icon;
  final IconData selectedIcon;
}
