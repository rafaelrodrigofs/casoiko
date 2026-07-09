import 'package:cloud_firestore/cloud_firestore.dart';

enum MessageType { text, image }

class Message {
  const Message({
    required this.id,
    required this.houseId,
    required this.type,
    required this.text,
    required this.sentBy,
    required this.sentByName,
    required this.sentAt,
    this.imageUrl,
  });

  final String id;
  final String houseId;
  final MessageType type;
  final String text;
  final String sentBy;
  final String sentByName;
  final DateTime sentAt;
  final String? imageUrl;

  bool get isImage => type == MessageType.image;

  factory Message.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    final typeRaw = data['type'] as String? ?? 'text';
    return Message(
      id: doc.id,
      houseId: data['house_id'] as String? ?? '',
      type: typeRaw == 'image' ? MessageType.image : MessageType.text,
      text: data['text'] as String? ?? '',
      sentBy: data['sent_by'] as String? ?? '',
      sentByName: data['sent_by_name'] as String? ?? '',
      sentAt: (data['sent_at'] as Timestamp?)?.toDate() ?? DateTime.now(),
      imageUrl: data['image_url'] as String?,
    );
  }
}
