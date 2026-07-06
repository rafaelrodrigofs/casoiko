import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../models/market_item.dart';
import '../../models/market_list.dart';
import '../../services/auth_service.dart';
import '../../services/house_service.dart';
import '../../services/market_service.dart';
import '../../utils/currency.dart';
import 'list_detail_screen.dart';
import 'products_screen.dart';

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
    _houseIdFuture = (user != null
            ? _houseService.ensureUserRegistered(user)
            : Future.value(HouseService.defaultHouseId))
        .then((houseId) async {
      await _marketService.ensureDefaults(houseId);
      return houseId;
    });
  }

  Future<void> _openNewListDialog(String houseId) async {
    final result = await showDialog<(String, String)>(
      context: context,
      builder: (_) => const _NewListDialog(),
    );
    if (result == null) return;

    final (name, emoji) = result;
    await _marketService.createList(
      houseId: houseId,
      name: name,
      emoji: emoji,
    );
  }

  Future<void> _confirmDeleteList(MarketList list) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Apagar "${list.name}"?'),
        content: const Text(
          'A lista e todos os itens dela serão apagados para todo mundo.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red[400]),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Apagar'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await _marketService.deleteList(list.id);
    }
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
            actions: [
              IconButton(
                tooltip: 'Catálogo de produtos',
                icon: const Icon(Icons.inventory_2_outlined),
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => ProductsScreen(
                        houseId: houseId,
                        marketService: _marketService,
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
          body: StreamBuilder<List<MarketList>>(
            stream: _marketService.listsStream(houseId),
            builder: (context, listsSnap) {
              if (listsSnap.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }

              if (listsSnap.hasError) {
                return Center(child: Text('Erro: ${listsSnap.error}'));
              }

              final lists = listsSnap.data ?? [];

              if (lists.isEmpty) {
                return const _EmptyState();
              }

              return StreamBuilder<List<MarketItem>>(
                stream: _marketService.houseItemsStream(houseId),
                builder: (context, itemsSnap) {
                  final items = itemsSnap.data ?? [];

                  return ListView.builder(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    itemCount: lists.length,
                    itemBuilder: (context, index) {
                      final list = lists[index];
                      final listItems =
                          items.where((i) => i.listId == list.id);
                      final pending =
                          listItems.where((i) => !i.bought).length;
                      final total = listItems.length;
                      final totalPrice = listItems.fold<double>(
                        0,
                        (sum, item) => sum + item.subtotal,
                      );

                      return _ListCard(
                        list: list,
                        pendingCount: pending,
                        totalCount: total,
                        totalPrice: totalPrice,
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => ListDetailScreen(
                                list: list,
                                houseId: houseId,
                                authService: widget.authService,
                                marketService: _marketService,
                              ),
                            ),
                          );
                        },
                        onLongPress: () => _confirmDeleteList(list),
                      );
                    },
                  );
                },
              );
            },
          ),
          floatingActionButton: FloatingActionButton.extended(
            onPressed: () => _openNewListDialog(houseId),
            backgroundColor: const Color(0xFF3D5A4C),
            foregroundColor: Colors.white,
            icon: const Icon(Icons.add),
            label: const Text('Nova lista'),
          ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Widgets internos
// ---------------------------------------------------------------------------

class _ListCard extends StatelessWidget {
  const _ListCard({
    required this.list,
    required this.pendingCount,
    required this.totalCount,
    required this.totalPrice,
    required this.onTap,
    required this.onLongPress,
  });

  final MarketList list;
  final int pendingCount;
  final int totalCount;
  final double totalPrice;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  @override
  Widget build(BuildContext context) {
    final date = DateFormat('dd/MM').format(list.createdAt);
    final status = totalCount == 0
        ? 'Lista vazia'
        : pendingCount == 0
            ? 'Tudo comprado! ($totalCount itens)'
            : '$pendingCount para comprar · $totalCount no total';
    final subtitle = [
      date,
      status,
      if (totalPrice > 0) formatPrice(totalPrice),
    ].join(' · ');

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          onLongPress: onLongPress,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: const Color(0xFF3D5A4C).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    list.emoji,
                    style: const TextStyle(fontSize: 24),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        list.name,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF2F3A2E),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: TextStyle(
                          fontSize: 13,
                          color:
                              const Color(0xFF5C6658).withValues(alpha: 0.8),
                        ),
                      ),
                    ],
                  ),
                ),
                if (pendingCount > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFF3D5A4C),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '$pendingCount',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  )
                else
                  Icon(
                    Icons.chevron_right,
                    color: const Color(0xFF5C6658).withValues(alpha: 0.5),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NewListDialog extends StatefulWidget {
  const _NewListDialog();

  @override
  State<_NewListDialog> createState() => _NewListDialogState();
}

class _NewListDialogState extends State<_NewListDialog> {
  static const _emojis = ['🛒', '🥬', '💊', '🐶', '🧰', '🎉', '🍖', '🏖️'];

  final _controller = TextEditingController();
  String _selectedEmoji = '🛒';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final name = _controller.text.trim();
    if (name.isEmpty) return;
    Navigator.of(context).pop((name, _selectedEmoji));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Nova lista'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _controller,
            autofocus: true,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              hintText: 'Ex: Feira, Farmácia, Churrasco...',
            ),
            onSubmitted: (_) => _submit(),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _emojis.map((emoji) {
              final selected = emoji == _selectedEmoji;
              return GestureDetector(
                onTap: () => setState(() => _selectedEmoji = emoji),
                child: Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: selected
                        ? const Color(0xFF3D5A4C).withValues(alpha: 0.15)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: selected
                          ? const Color(0xFF3D5A4C)
                          : Colors.grey[300]!,
                      width: selected ? 2 : 1,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Text(emoji, style: const TextStyle(fontSize: 20)),
                ),
              );
            }).toList(),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFF3D5A4C),
          ),
          onPressed: _submit,
          child: const Text('Criar'),
        ),
      ],
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
              'Nenhuma lista ainda',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: Color(0xFF2F3A2E),
              ),
            ),
            SizedBox(height: 8),
            Text(
              'Crie uma lista para o mercado, feira ou farmácia.',
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
