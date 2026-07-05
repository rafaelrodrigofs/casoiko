import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../models/message.dart';
import '../../services/auth_service.dart';
import '../../services/chat_service.dart';
import '../../services/house_service.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, required this.authService});

  final AuthService authService;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _chatService = ChatService();
  final _houseService = HouseService();
  final _controller = TextEditingController();
  final _scrollController = ScrollController();

  late final Future<String> _houseIdFuture;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    final user = widget.authService.currentUser;
    _houseIdFuture = user != null
        ? _houseService.ensureUserRegistered(user)
        : Future.value(HouseService.defaultHouseId);
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
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

    setState(() => _sending = false);
    _scrollToBottom();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
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

        final houseId = houseSnap.data ?? HouseService.defaultHouseId;
        final currentUid = widget.authService.currentUser?.uid ?? '';

        return Scaffold(
          backgroundColor: const Color(0xFFF5F0E8),
          appBar: AppBar(
            backgroundColor: const Color(0xFF3D5A4C),
            foregroundColor: Colors.white,
            title: const Text('Bate-papo'),
          ),
          body: Column(
            children: [
              Expanded(
                child: StreamBuilder<List<Message>>(
                  stream: _chatService.messagesStream(houseId),
                  builder: (context, snap) {
                    if (snap.connectionState == ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator());
                    }

                    if (snap.hasError) {
                      return Center(child: Text('Erro: ${snap.error}'));
                    }

                    final messages = snap.data ?? [];

                    if (messages.isEmpty) {
                      return const _EmptyState();
                    }

                    WidgetsBinding.instance.addPostFrameCallback(
                      (_) => _scrollToBottom(),
                    );

                    return ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 12,
                      ),
                      itemCount: messages.length,
                      itemBuilder: (context, index) {
                        final msg = messages[index];
                        final isMe = msg.sentBy == currentUid;
                        final showName = !isMe &&
                            (index == 0 ||
                                messages[index - 1].sentBy != msg.sentBy);

                        return _MessageBubble(
                          message: msg,
                          isMe: isMe,
                          showName: showName,
                        );
                      },
                    );
                  },
                ),
              ),
              _InputBar(
                controller: _controller,
                sending: _sending,
                onSend: () => _send(houseId),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Widgets internos
// ---------------------------------------------------------------------------

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.isMe,
    required this.showName,
  });

  final Message message;
  final bool isMe;
  final bool showName;

  @override
  Widget build(BuildContext context) {
    final time = DateFormat('HH:mm').format(message.sentAt);

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.72,
        ),
        margin: EdgeInsets.only(
          bottom: 4,
          top: showName ? 12 : 2,
        ),
        child: Column(
          crossAxisAlignment:
              isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            if (showName)
              Padding(
                padding: const EdgeInsets.only(left: 4, bottom: 2),
                child: Text(
                  message.sentByName,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF3D5A4C),
                  ),
                ),
              ),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: isMe ? const Color(0xFF3D5A4C) : Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(18),
                  topRight: const Radius.circular(18),
                  bottomLeft: Radius.circular(isMe ? 18 : 4),
                  bottomRight: Radius.circular(isMe ? 4 : 18),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.06),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    message.text,
                    style: TextStyle(
                      fontSize: 15,
                      color: isMe ? Colors.white : const Color(0xFF2F3A2E),
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
                          : const Color(0xFF5C6658),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InputBar extends StatelessWidget {
  const _InputBar({
    required this.controller,
    required this.sending,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;

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
                fillColor: const Color(0xFFF5F0E8),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
              ),
              onSubmitted: (_) => onSend(),
            ),
          ),
          const SizedBox(width: 8),
          Material(
            color: const Color(0xFF3D5A4C),
            borderRadius: BorderRadius.circular(24),
            child: InkWell(
              borderRadius: BorderRadius.circular(24),
              onTap: sending ? null : onSend,
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
              color: Color(0xFF3D5A4C),
            ),
            SizedBox(height: 20),
            Text(
              'Nenhuma mensagem ainda',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: Color(0xFF2F3A2E),
              ),
            ),
            SizedBox(height: 8),
            Text(
              'Manda o primeiro recado pra família.',
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
