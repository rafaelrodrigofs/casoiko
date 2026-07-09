import 'dart:convert';
import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../config/media_api_config.dart';
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
      'type': 'text',
      'text': text.trim(),
      'sent_by': sentBy,
      'sent_by_name': sentByName,
      'sent_at': FieldValue.serverTimestamp(),
    });
  }

  Future<void> sendImageMessage({
    required String houseId,
    required String sentBy,
    required String sentByName,
    required File imageFile,
  }) async {
    final idToken = await FirebaseAuth.instance.currentUser?.getIdToken();
    if (idToken == null || idToken.isEmpty) {
      throw Exception('Usuário não autenticado');
    }

    final imageUrl = await _uploadChatImage(
      imageFile: imageFile,
      houseId: houseId,
      idToken: idToken,
    );

    await _firestore.collection('messages').add({
      'house_id': houseId,
      'type': 'image',
      'text': '',
      'image_url': imageUrl,
      'sent_by': sentBy,
      'sent_by_name': sentByName,
      'sent_at': FieldValue.serverTimestamp(),
    });
  }

  Future<String> _uploadChatImage({
    required File imageFile,
    required String houseId,
    required String idToken,
  }) async {
    final path = imageFile.path.toLowerCase();
    final isPng = path.endsWith('.png');
    final uri = Uri.parse('$kMediaApiBaseUrl/api/chat/upload');
    final request = http.MultipartRequest('POST', uri)
      ..headers['Authorization'] = 'Bearer $idToken'
      ..fields['house_id'] = houseId
      ..files.add(
        await http.MultipartFile.fromPath(
          'image',
          imageFile.path,
          filename: isPng ? 'photo.png' : 'photo.jpg',
          contentType: MediaType('image', isPng ? 'png' : 'jpeg'),
        ),
      );

    final streamed = await request.send().timeout(const Duration(seconds: 60));
    final response = await http.Response.fromStream(streamed);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        'Upload falhou (${response.statusCode}): ${response.body}',
      );
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final url = data['url'] as String?;
    if (url == null || url.isEmpty) {
      throw Exception('Resposta do servidor sem URL da imagem');
    }
    return url;
  }

  Future<void> deleteMessage(String messageId) {
    return _firestore.collection('messages').doc(messageId).delete();
  }

  Future<void> deleteMessages(Iterable<String> messageIds) async {
    final ids = messageIds.toList();
    if (ids.isEmpty) return;

    final batch = _firestore.batch();
    for (final id in ids) {
      batch.delete(_firestore.collection('messages').doc(id));
    }
    await batch.commit();
  }
}
