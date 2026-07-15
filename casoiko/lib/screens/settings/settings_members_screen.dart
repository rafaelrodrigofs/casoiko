import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:casoiko/theme/app_colors.dart';

import '../../models/finance_transaction.dart';
import '../../services/finance_service.dart';
import '../../services/house_service.dart';
import 'settings_widgets.dart';

class SettingsMembersScreen extends StatelessWidget {
  const SettingsMembersScreen({
    super.key,
    required this.houseId,
    required this.currentUid,
  });

  final String houseId;
  final String currentUid;

  @override
  Widget build(BuildContext context) {
    final finance = FinanceService();
    final houseService = HouseService();

    return SettingsScaffold(
      title: 'Membros',
      child: StreamBuilder<List<HouseMember>>(
        stream: finance.membersStream(houseId),
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting &&
              !snap.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final members = snap.data ?? [];
          HouseMember? me;
          for (final m in members) {
            if (m.uid == currentUid) {
              me = m;
              break;
            }
          }
          final hasAdmin = members.any((m) => m.isAdmin);
          // Se ainda não há admin, qualquer um pode gerenciar (bootstrap).
          final canManageOthers = (me?.isAdmin ?? false) || !hasAdmin;

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            children: [
              const SettingsSectionLabel('QUEM PARTICIPA'),
              for (final m in members) ...[
                _MemberCard(
                  member: m,
                  isYou: m.uid == currentUid,
                  canManage: canManageOthers && m.uid != currentUid,
                  onSetAdmin: () => _setRole(
                    context,
                    houseService,
                    m,
                    role: 'admin',
                  ),
                  onSetMember: () => _setRole(
                    context,
                    houseService,
                    m,
                    role: 'member',
                  ),
                  onRemove: () => _confirmRemove(
                    context,
                    houseService,
                    m,
                  ),
                ),
                const SizedBox(height: 10),
              ],
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton(
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: houseId));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                          'Código da casa copiado. Convite completo em breve.',
                        ),
                      ),
                    );
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text('+  Convidar membro'),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _setRole(
    BuildContext context,
    HouseService houseService,
    HouseMember member, {
    required String role,
  }) async {
    try {
      await houseService.setMemberRole(uid: member.uid, role: role);
      if (!context.mounted) return;
      final label = role == 'admin' ? 'administrador' : 'membro';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${member.firstName} agora é $label')),
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Não foi possível alterar: $e')),
      );
    }
  }

  Future<void> _confirmRemove(
    BuildContext context,
    HouseService houseService,
    HouseMember member,
  ) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remover da casa'),
        content: Text(
          'Remover ${member.name} desta casa? A pessoa perde o acesso às tarefas, listas e contas.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            child: const Text('Remover'),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;

    try {
      await houseService.removeMemberFromHouse(
        uid: member.uid,
        houseId: houseId,
      );
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${member.firstName} foi removido(a) da casa')),
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Não foi possível remover: $e')),
      );
    }
  }
}

class _MemberCard extends StatelessWidget {
  const _MemberCard({
    required this.member,
    required this.isYou,
    required this.canManage,
    required this.onSetAdmin,
    required this.onSetMember,
    required this.onRemove,
  });

  final HouseMember member;
  final bool isYou;
  final bool canManage;
  final VoidCallback onSetAdmin;
  final VoidCallback onSetMember;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final role = member.isAdmin ? 'Admin' : 'Membro';
    final subtitle = isYou ? '$role · você' : role;

    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        child: Row(
          children: [
            const SizedBox(width: 6),
            CircleAvatar(
              radius: 22,
              backgroundColor: AppColors.primary.withValues(alpha: 0.12),
              backgroundImage: member.photoUrl.isNotEmpty
                  ? NetworkImage(member.photoUrl)
                  : null,
              child: member.photoUrl.isEmpty
                  ? Text(
                      member.firstName.isNotEmpty
                          ? member.firstName[0].toUpperCase()
                          : '?',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    member.name,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary.withValues(alpha: 0.9),
                    ),
                  ),
                ],
              ),
            ),
            if (canManage)
              PopupMenuButton<_MemberAction>(
                tooltip: 'Opções',
                icon: const Icon(
                  Icons.more_vert,
                  color: AppColors.textSecondary,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                onSelected: (action) {
                  switch (action) {
                    case _MemberAction.makeAdmin:
                      onSetAdmin();
                    case _MemberAction.makeMember:
                      onSetMember();
                    case _MemberAction.remove:
                      onRemove();
                  }
                },
                itemBuilder: (context) => [
                  if (!member.isAdmin)
                    const PopupMenuItem(
                      value: _MemberAction.makeAdmin,
                      child: ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(Icons.shield_outlined),
                        title: Text('Tornar administrador'),
                        dense: true,
                        visualDensity: VisualDensity.compact,
                      ),
                    )
                  else
                    const PopupMenuItem(
                      value: _MemberAction.makeMember,
                      child: ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(Icons.person_outline),
                        title: Text('Tornar membro'),
                        dense: true,
                        visualDensity: VisualDensity.compact,
                      ),
                    ),
                  const PopupMenuDivider(),
                  const PopupMenuItem(
                    value: _MemberAction.remove,
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(
                        Icons.person_remove_outlined,
                        color: AppColors.danger,
                      ),
                      title: Text(
                        'Remover da casa',
                        style: TextStyle(color: AppColors.danger),
                      ),
                      dense: true,
                      visualDensity: VisualDensity.compact,
                    ),
                  ),
                ],
              )
            else
              const SizedBox(width: 12),
          ],
        ),
      ),
    );
  }
}

enum _MemberAction { makeAdmin, makeMember, remove }
