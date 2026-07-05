import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/message.dart';

class ChatService {
  ChatService({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  /// Stream em tempo real das mensagens da casa, em ordem cronológica.
  /// Ordenação no cliente para evitar índice composto no Firestore.
  Stream<List<Message>> messagesStream(String houseId) {
    return _firestore
        .collection('messages')
        .where('house_id', isEqualTo: houseId)
        .snapshots()
        .map((snap) {
      final items = snap.docs.map(Message.fromFirestore).toList();
      items.sort((a, b) => a.sentAt.compareTo(b.sentAt));
      if (items.length > 100) {
        return items.sublist(items.length - 100);
      }
      return items;
    });
  }

  Future<void> sendMessage({
    required String houseId,
    required String text,
    required String sentBy,
    required String sentByName,
  }) {
    return _firestore.collection('messages').add({
      'house_id': houseId,
      'text': text.trim(),
      'sent_by': sentBy,
      'sent_by_name': sentByName,
      'sent_at': FieldValue.serverTimestamp(),
    });
  }
}
