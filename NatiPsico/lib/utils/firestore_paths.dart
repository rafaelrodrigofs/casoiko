import 'package:cloud_firestore/cloud_firestore.dart';

/// Caminhos Firestore multi-tenant: professionals/{uid}/...
abstract final class FirestorePaths {
  static DocumentReference<Map<String, dynamic>> professional(String uid) =>
      FirebaseFirestore.instance.collection('professionals').doc(uid);

  static CollectionReference<Map<String, dynamic>> patients(String uid) =>
      professional(uid).collection('patients');

  static CollectionReference<Map<String, dynamic>> appointments(String uid) =>
      professional(uid).collection('appointments');

  static CollectionReference<Map<String, dynamic>> sessions(String uid) =>
      professional(uid).collection('sessions');

  static CollectionReference<Map<String, dynamic>> payments(String uid) =>
      professional(uid).collection('payments');
}
