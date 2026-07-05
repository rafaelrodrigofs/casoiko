import 'package:flutter/material.dart';

import '../../models/market_item.dart';
import '../../services/auth_service.dart';
import '../../services/house_service.dart';
import '../../services/market_service.dart';
import 'add_item_sheet.dart';

class MercadoScreen extends StatefulWidget {
  const MercadoScreen({super.key, required this.authService});

  final AuthService authService;

  @override
  State<MercadoScreen> createState() => _MercadoScreenState();
}

class _MercadoScreenState extends State<MercadoScreen> {
  final _houseService = HouseService();
  final _marketService = MarketService();

  late final Future<String> _houseIdFuture;

  @override
  void initState() {
    super.initState();
    final user = widget.authService.currentUser;
    _houseIdFuture = user != null
        ? _houseService.ensureUserRegistered(user)
        : Future.value(HouseService.defaultHouseId);
  }

  Future<void> _openAddSheet(String houseId) async {
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const AddItemSheet(),
    );

    if (result == null || result.isEmpty || !mounted) return;

    final user = widget.authService.currentUser;
    await _marketService.addItem(
      houseId: houseId,
      name: result,
      addedBy: user?.uid ?? '',
      addedByName: user?.displayName ?? 'Alguém',
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<String>(
      future: _houseIdFuture,
      builder: (context, houseSnap) {
        if (houseSnap.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            backgroundColor: Color(0xFFF5F0E8),
            body: Center(child: CircularProgressIndicator()),
          );
        }

        if (houseSnap.hasError) {
          return Scaffold(
            backgroundColor: const Color(0xFFF5F0E8),
            body: Center(
              child: Text('Erro ao carregar: ${houseSnap.error}'),
            ),
          );
        }

        final houseId = houseSnap.data ?? HouseService.defaultHouseId;

        return Scaffold(
          backgroundColor: const Color(0xFFF5F0E8),
          appBar: AppBar(
            backgroundColor: const Color(0xFF3D5A4C),
            foregroundColor: Colors.white,
            title: const Text('Mercado'),
          ),
          body: StreamBuilder<List<MarketItem>>(
            stream: _marketService.itemsStream(houseId),
            builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }

              if (snap.hasError) {
                return Center(child: Text('Erro: ${snap.error}'));
              }

              final items = snap.data ?? [];

              if (items.isEmpty) {
                return const _EmptyState();
              }

              final pending = items.where((i) => !i.bought).toList();
              final bought = items.where((i) => i.bought).toList();

              return ListView(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                children: [
                  if (pending.isNotEmpty) ...[
                    _SectionHeader(label: 'Para comprar (${pending.length})'),
                    ...pending.map(
                      (item) => _ItemTile(
                        key: ValueKey(item.id),
                        item: item,
                        onToggle: () => _marketService.toggleBought(
                          item.id,
                          newValue: !item.bought,
                        ),
                        onDelete: () => _marketService.deleteItem(item.id),
                      ),
                    ),
                  ],
                  if (bought.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    _SectionHeader(
                      label: 'Comprado (${bought.length})',
                      faded: true,
                    ),
                    ...bought.map(
                      (item) => _ItemTile(
                        key: ValueKey(item.id),
                        item: item,
                        onToggle: () => _marketService.toggleBought(
                          item.id,
                          newValue: !item.bought,
                        ),
                        onDelete: () => _marketService.deleteItem(item.id),
                      ),
                    ),
                  ],
                ],
              );
            },
          ),
          floatingActionButton: FloatingActionButton(
            onPressed: () => _openAddSheet(houseId),
            backgroundColor: const Color(0xFF3D5A4C),
            foregroundColor: Colors.white,
            tooltip: 'Adicionar item',
            child: const Icon(Icons.add),
          ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Widgets internos
// ---------------------------------------------------------------------------

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.label, this.faded = false});

  final String label;
  final bool faded;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, top: 4, bottom: 8),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.8,
          color: faded
              ? const Color(0xFF5C6658).withValues(alpha: 0.5)
              : const Color(0xFF5C6658),
        ),
      ),
    );
  }
}

class _ItemTile extends StatelessWidget {
  const _ItemTile({
    super.key,
    required this.item,
    required this.onToggle,
    required this.onDelete,
  });

  final MarketItem item;
  final VoidCallback onToggle;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Dismissible(
      key: ValueKey(item.id),
      direction: DismissDirection.endToStart,
      background: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: Colors.red[400],
          borderRadius: BorderRadius.circular(14),
        ),
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        child: const Icon(Icons.delete_outline, color: Colors.white, size: 22),
      ),
      onDismissed: (_) => onDelete(),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: item.bought
              ? Colors.white.withValues(alpha: 0.55)
              : Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: ListTile(
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
          leading: Checkbox(
            value: item.bought,
            onChanged: (_) => onToggle(),
            activeColor: const Color(0xFF3D5A4C),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(6),
            ),
          ),
          title: Text(
            item.name,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w500,
              color: item.bought
                  ? const Color(0xFF5C6658).withValues(alpha: 0.55)
                  : const Color(0xFF2F3A2E),
              decoration: item.bought ? TextDecoration.lineThrough : null,
              decorationColor:
                  const Color(0xFF5C6658).withValues(alpha: 0.55),
            ),
          ),
          subtitle: item.addedByName.isNotEmpty
              ? Text(
                  item.addedByName,
                  style: TextStyle(
                    fontSize: 12,
                    color: const Color(0xFF5C6658).withValues(alpha: 0.65),
                  ),
                )
              : null,
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.shopping_basket_outlined,
              size: 72,
              color: Color(0xFF3D5A4C),
            ),
            SizedBox(height: 20),
            Text(
              'Lista vazia!',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: Color(0xFF2F3A2E),
              ),
            ),
            SizedBox(height: 8),
            Text(
              'Toque no + para adicionar o que precisa comprar.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 15,
                color: Color(0xFF5C6658),
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
