import 'package:cloud_firestore/cloud_firestore.dart';

class Message {
  const Message({
    required this.id,
    required this.houseId,
    required this.text,
    required this.sentBy,
    required this.sentByName,
    required this.sentAt,
  });

  final String id;
  final String houseId;
  final String text;
  final String sentBy;
  final String sentByName;
  final DateTime sentAt;

  factory Message.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Message(
      id: doc.id,
      houseId: data['house_id'] as String? ?? '',
      text: data['text'] as String? ?? '',
      sentBy: data['sent_by'] as String? ?? '',
      sentByName: data['sent_by_name'] as String? ?? '',
      sentAt: (data['sent_at'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }
}
