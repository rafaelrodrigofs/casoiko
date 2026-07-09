import 'dart:io';

import 'package:flutter/material.dart';
import 'package:casoiko/theme/app_colors.dart';
import 'package:image_picker/image_picker.dart';

import 'package:intl/intl.dart';

import '../../models/finance_transaction.dart';
import '../../models/message.dart';
import '../../services/auth_service.dart';
import '../../services/chat_service.dart';
import '../../services/finance_service.dart';
import '../../services/grouped_notification_manager.dart';
import '../../services/house_service.dart';
import 'chat_image_preview_sheet.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, required this.authService});

  final AuthService authService;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _chatService = ChatService();
  final _houseService = HouseService();
  final _financeService = FinanceService();
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final _selection = ValueNotifier<Set<String>>({});

  late final Future<String> _houseIdFuture;
  bool _sending = false;
  bool _sendingPhoto = false;

  @override
  void initState() {
    super.initState();
    final user = widget.authService.currentUser;
    _houseIdFuture = user != null
        ? _houseService.ensureUserRegistered(user)
        : Future.value(HouseService.defaultHouseId);
    // Abriu o chat: limpa a notificacao agrupada de mensagens.
    GroupedNotificationManager.instance.clearChat();
  }

  @override
  void dispose() {
    _selection.dispose();
    _scrollController.dispose();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send(String houseId) async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;

    setState(() => _sending = true);
    _controller.clear();

    final user = widget.authService.currentUser;
    await _chatService.sendMessage(
      houseId: houseId,
      text: text,
      sentBy: user?.uid ?? '',
      sentByName: user?.displayName ?? 'Alguém',
    );

    if (mounted) setState(() => _sending = false);
  }

  Future<void> _takePhoto(String houseId) async {
    if (_sending || _sendingPhoto) return;

    final picked = await ImagePicker().pickImage(
      source: ImageSource.camera,
      maxWidth: 1280,
      maxHeight: 1280,
      imageQuality: 75,
    );
    if (picked == null || !mounted) return;

    final imageFile = File(picked.path);
    final user = widget.authService.currentUser;

    await ChatImagePreviewSheet.show(
      context,
      imageFile: imageFile,
      onSend: () async {
        setState(() => _sendingPhoto = true);
        try {
          await _chatService.sendImageMessage(
            houseId: houseId,
            sentBy: user?.uid ?? '',
            sentByName: user?.displayName ?? 'Alguém',
            imageFile: imageFile,
          );
        } finally {
          if (mounted) setState(() => _sendingPhoto = false);
        }
      },
    );
  }

  void _startSelection(String messageId) {
    _selection.value = {..._selection.value, messageId};
  }

  void _toggleSelection(String messageId) {
    final next = Set<String>.from(_selection.value);
    if (next.contains(messageId)) {
      next.remove(messageId);
    } else {
      next.add(messageId);
    }
    _selection.value = next;
  }

  void _clearSelection() {
    if (_selection.value.isEmpty) return;
    _selection.value = {};
  }

  Future<void> _deleteSelected() async {
    final ids = _selection.value.toList();
    if (ids.isEmpty) return;

    _selection.value = {};

    try {
      await _chatService.deleteMessages(ids);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Não foi possível excluir: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<String>(
      future: _houseIdFuture,
      builder: (context, houseSnap) {
        if (houseSnap.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final houseId = houseSnap.data ?? HouseService.defaultHouseId;
        final currentUid = widget.authService.currentUser?.uid ?? '';
        final currentPhotoUrl = widget.authService.currentUser?.photoURL ?? '';

        return ValueListenableBuilder<Set<String>>(
          valueListenable: _selection,
          builder: (context, selectedIds, child) {
            return PopScope(
              canPop: selectedIds.isEmpty,
              onPopInvokedWithResult: (didPop, result) {
                if (!didPop && selectedIds.isNotEmpty) _clearSelection();
              },
              child: child!,
            );
          },
          child: Scaffold(
            appBar: PreferredSize(
              preferredSize: const Size.fromHeight(kToolbarHeight),
              child: ValueListenableBuilder<Set<String>>(
                valueListenable: _selection,
                builder: (context, selectedIds, _) {
                  return _ChatAppBar(
                    selectedCount: selectedIds.length,
                    onClearSelection: _clearSelection,
                    onDelete: _deleteSelected,
                  );
                },
              ),
            ),
            body: Column(
              children: [
                Expanded(
                  child: StreamBuilder<List<HouseMember>>(
                    stream: _financeService.membersStream(houseId),
                    builder: (context, membersSnap) {
                      final photoByUid = <String, String>{
                        for (final m in membersSnap.data ?? [])
                          m.uid: m.photoUrl,
                      };
                      if (currentUid.isNotEmpty && currentPhotoUrl.isNotEmpty) {
                        photoByUid[currentUid] = currentPhotoUrl;
                      }

                      return StreamBuilder<List<Message>>(
                        stream: _chatService.messagesStream(houseId),
                        builder: (context, snap) {
                          if (snap.connectionState == ConnectionState.waiting) {
                            return const Center(
                              child: CircularProgressIndicator(),
                            );
                          }

                          if (snap.hasError) {
                            return Center(child: Text('Erro: ${snap.error}'));
                          }

                          final messages = snap.data ?? [];

                          if (messages.isEmpty) {
                            return const _EmptyState();
                          }

                          return _SelectableMessageList(
                            messages: messages,
                            currentUid: currentUid,
                            photoByUid: photoByUid,
                            scrollController: _scrollController,
                            selection: _selection,
                            onStartSelection: _startSelection,
                            onToggleSelection: _toggleSelection,
                          );
                        },
                      );
                    },
                  ),
                ),
                _InputBar(
                  controller: _controller,
                  sending: _sending,
                  sendingPhoto: _sendingPhoto,
                  onSend: () => _send(houseId),
                  onCameraTap: () => _takePhoto(houseId),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Widgets internos
// ---------------------------------------------------------------------------

class _ChatAppBar extends StatelessWidget implements PreferredSizeWidget {
  const _ChatAppBar({
    required this.selectedCount,
    required this.onClearSelection,
    required this.onDelete,
  });

  final int selectedCount;
  final VoidCallback onClearSelection;
  final VoidCallback onDelete;

  bool get _selecting => selectedCount > 0;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      leading: _selecting
          ? IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: onClearSelection,
            )
          : null,
      automaticallyImplyLeading: !_selecting,
      title: Text(
        _selecting ? '$selectedCount' : 'Bate-papo',
        style: TextStyle(
          fontWeight: _selecting ? FontWeight.w700 : FontWeight.w500,
          fontSize: _selecting ? 20 : null,
        ),
      ),
      actions: _selecting
          ? [
              IconButton(
                tooltip: 'Excluir',
                icon: const Icon(Icons.delete_outline),
                onPressed: onDelete,
              ),
            ]
          : null,
    );
  }
}

class _SelectableMessageList extends StatelessWidget {
  const _SelectableMessageList({
    required this.messages,
    required this.currentUid,
    required this.photoByUid,
    required this.scrollController,
    required this.selection,
    required this.onStartSelection,
    required this.onToggleSelection,
  });

  final List<Message> messages;
  final String currentUid;
  final Map<String, String> photoByUid;
  final ScrollController scrollController;
  final ValueNotifier<Set<String>> selection;
  final void Function(String messageId) onStartSelection;
  final void Function(String messageId) onToggleSelection;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<Set<String>>(
      valueListenable: selection,
      builder: (context, selectedIds, _) {
        final selecting = selectedIds.isNotEmpty;

        return ListView.builder(
          key: const PageStorageKey<String>('chat_messages'),
          controller: scrollController,
          reverse: true,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          itemCount: messages.length,
          itemBuilder: (context, index) {
            final msgIndex = messages.length - 1 - index;
            final msg = messages[msgIndex];
            final isMe = msg.sentBy == currentUid;
            final showName = !isMe &&
                (msgIndex == 0 ||
                    messages[msgIndex - 1].sentBy != msg.sentBy);
            final showAvatar = !isMe &&
                (msgIndex == messages.length - 1 ||
                    messages[msgIndex + 1].sentBy != msg.sentBy);

            return _MessageBubble(
              message: msg,
              isMe: isMe,
              showName: showName,
              showAvatar: showAvatar,
              photoUrl: photoByUid[msg.sentBy],
              isSelected: selectedIds.contains(msg.id),
              onTap: () {
                if (selecting) onToggleSelection(msg.id);
              },
              onLongPress: () {
                if (selecting) {
                  onToggleSelection(msg.id);
                } else {
                  onStartSelection(msg.id);
                }
              },
            );
          },
        );
      },
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.isMe,
    required this.showName,
    required this.showAvatar,
    required this.photoUrl,
    required this.isSelected,
    required this.onTap,
    required this.onLongPress,
  });

  final Message message;
  final bool isMe;
  final bool showName;
  final bool showAvatar;
  final String? photoUrl;
  final bool isSelected;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  @override
  Widget build(BuildContext context) {
    final time = DateFormat('HH:mm').format(message.sentAt);
    final borderRadius = BorderRadius.only(
      topLeft: const Radius.circular(18),
      topRight: const Radius.circular(18),
      bottomLeft: Radius.circular(isMe ? 18 : 4),
      bottomRight: Radius.circular(isMe ? 4 : 18),
    );

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Row(
        mainAxisAlignment:
            isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMe) ...[
            showAvatar
                ? _ChatAvatar(
                    name: message.sentByName,
                    photoUrl: photoUrl,
                  )
                : const SizedBox(width: 28),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: Container(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.72,
              ),
              margin: EdgeInsets.only(
                bottom: 4,
                top: showName ? 12 : 2,
              ),
              child: Column(
                crossAxisAlignment: isMe
                    ? CrossAxisAlignment.end
                    : CrossAxisAlignment.start,
                children: [
                  if (showName)
                    Padding(
                      padding: const EdgeInsets.only(left: 4, bottom: 2),
                      child: Text(
                        message.sentByName,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                  GestureDetector(
                    onTap: onTap,
                    onLongPress: onLongPress,
                    child: Stack(
                      children: [
                        Container(
                          clipBehavior: Clip.antiAlias,
                          decoration: BoxDecoration(
                            color: message.isImage
                                ? (isMe ? AppColors.primary : Colors.white)
                                : (isMe ? AppColors.primary : Colors.white),
                            borderRadius: borderRadius,
                            border: isSelected
                                ? Border.all(
                                    color: AppColors.primary,
                                    width: 2,
                                  )
                                : null,
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.06),
                                blurRadius: 6,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: message.isImage
                              ? _ImageMessageContent(
                                  imageUrl: message.imageUrl ?? '',
                                  time: time,
                                  isMe: isMe,
                                )
                              : _TextMessageContent(
                                  text: message.text,
                                  time: time,
                                  isMe: isMe,
                                ),
                        ),
                        Positioned.fill(
                          child: IgnorePointer(
                            child: AnimatedOpacity(
                              duration: const Duration(milliseconds: 120),
                              opacity: isSelected ? 1 : 0,
                              child: DecoratedBox(
                                decoration: BoxDecoration(
                                  borderRadius: borderRadius,
                                  color: AppColors.primary
                                      .withValues(alpha: 0.22),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ChatAvatar extends StatelessWidget {
  const _ChatAvatar({
    required this.name,
    required this.photoUrl,
  });

  final String name;
  final String? photoUrl;

  @override
  Widget build(BuildContext context) {
    final initial = name.trim().isNotEmpty ? name.trim()[0].toUpperCase() : '?';
    final url = photoUrl ?? '';

    return CircleAvatar(
      radius: 14,
      backgroundColor: AppColors.primary.withValues(alpha: 0.15),
      backgroundImage: url.isNotEmpty ? NetworkImage(url) : null,
      child: url.isEmpty
          ? Text(
              initial,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.primary,
              ),
            )
          : null,
    );
  }
}

class _TextMessageContent extends StatelessWidget {
  const _TextMessageContent({
    required this.text,
    required this.time,
    required this.isMe,
  });

  final String text;
  final String time;
  final bool isMe;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            text,
            style: TextStyle(
              fontSize: 15,
              color: isMe ? Colors.white : AppColors.textPrimary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            time,
            style: TextStyle(
              fontSize: 11,
              color: isMe
                  ? Colors.white.withValues(alpha: 0.65)
                  : AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _ImageMessageContent extends StatelessWidget {
  const _ImageMessageContent({
    required this.imageUrl,
    required this.time,
    required this.isMe,
  });

  final String imageUrl;
  final String time;
  final bool isMe;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 240),
          child: Image.network(
            imageUrl,
            fit: BoxFit.cover,
            loadingBuilder: (context, child, progress) {
              if (progress == null) return child;
              return const SizedBox(
                height: 180,
                child: Center(
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              );
            },
            errorBuilder: (context, error, stackTrace) {
              return Container(
                height: 180,
                color: AppColors.surfaceMuted,
                alignment: Alignment.center,
                child: const Icon(
                  Icons.broken_image_outlined,
                  color: AppColors.textSecondary,
                  size: 40,
                ),
              );
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(10, 4, 10, 8),
          child: Align(
            alignment: Alignment.centerRight,
            child: Text(
              time,
              style: TextStyle(
                fontSize: 11,
                color: isMe
                    ? Colors.white.withValues(alpha: 0.65)
                    : AppColors.textSecondary,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _InputBar extends StatelessWidget {
  const _InputBar({
    required this.controller,
    required this.sending,
    required this.sendingPhoto,
    required this.onSend,
    required this.onCameraTap,
  });

  final TextEditingController controller;
  final bool sending;
  final bool sendingPhoto;
  final VoidCallback onSend;
  final VoidCallback onCameraTap;

  bool get _busy => sending || sendingPhoto;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: EdgeInsets.only(
        left: 12,
        right: 8,
        top: 8,
        bottom: MediaQuery.of(context).padding.bottom + 8,
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              textCapitalization: TextCapitalization.sentences,
              minLines: 1,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: 'Mensagem...',
                filled: true,
                fillColor: AppColors.surfaceMuted,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
                suffixIcon: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      tooltip: 'Anexar arquivo',
                      onPressed: () {},
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(
                        Icons.attach_file_rounded,
                        color: AppColors.primary,
                        size: 24,
                      ),
                    ),
                    IconButton(
                      tooltip: 'Câmera',
                      onPressed: _busy ? null : onCameraTap,
                      visualDensity: VisualDensity.compact,
                      icon: sendingPhoto
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(
                              Icons.camera_alt_outlined,
                              color: AppColors.primary,
                              size: 24,
                            ),
                    ),
                  ],
                ),
                suffixIconConstraints: const BoxConstraints(
                  minWidth: 0,
                  minHeight: 48,
                ),
              ),
              onSubmitted: (_) => onSend(),
            ),
          ),
          const SizedBox(width: 8),
          Material(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(24),
            child: InkWell(
              borderRadius: BorderRadius.circular(24),
              onTap: _busy ? null : onSend,
              child: const Padding(
                padding: EdgeInsets.all(12),
                child: Icon(Icons.send_rounded, color: Colors.white, size: 22),
              ),
            ),
          ),
        ],
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
              Icons.chat_bubble_outline_rounded,
              size: 72,
              color: AppColors.primary,
            ),
            SizedBox(height: 20),
            Text(
              'Nenhuma mensagem ainda',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            SizedBox(height: 8),
            Text(
              'Manda o primeiro recado pra família.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 15,
                color: AppColors.textSecondary,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
