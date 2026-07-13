import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:casoiko/theme/app_colors.dart';

/// Altura da barra compacta das abas (sem status bar).
const kShellTabBarHeight = 44.0;

const _kShellTabBarBottomRadius = 24.0;

/// Header estático das abas Mercado, Contas e Chat — mesmo visual da Casa colapsada.
class ShellTabBar extends StatelessWidget {
  const ShellTabBar({
    super.key,
    required this.title,
    required this.icon,
    this.subtitle,
    this.leading,
    this.actions = const [],
    this.showIcon = true,
  });

  final String title;
  final IconData icon;
  final String? subtitle;
  final Widget? leading;
  final List<Widget> actions;
  final bool showIcon;

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.paddingOf(context).top;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.primaryDark,
              AppColors.primary,
              AppColors.primaryMid,
            ],
          ),
          borderRadius: BorderRadius.vertical(
            bottom: Radius.circular(_kShellTabBarBottomRadius),
          ),
        ),
        child: ClipRRect(
          borderRadius: const BorderRadius.vertical(
            bottom: Radius.circular(_kShellTabBarBottomRadius),
          ),
          child: Padding(
            padding: EdgeInsets.only(top: topPadding),
            child: SizedBox(
              height: kShellTabBarHeight,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 8, 0),
                child: Row(
                  children: [
                    ?leading,
                    if (showIcon) ...[
                      Icon(icon, color: Colors.white, size: 22),
                      const SizedBox(width: 8),
                    ],
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: showIcon ? 17 : 20,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          subtitle!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Colors.white.withValues(alpha: 0.85),
                          ),
                        ),
                      ),
                    ] else
                      const Spacer(),
                    ...actions,
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
