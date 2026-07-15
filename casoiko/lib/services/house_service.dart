import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class HouseService {
  HouseService({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  static const String defaultHouseId = 'casoiko-principal';

  /// Garante que o usuário existe no Firestore e retorna o house_id.
  /// Na primeira vez, cria o documento da casa e do usuário.
  Future<String> ensureUserRegistered(User user) async {
    final userRef = _firestore.collection('users').doc(user.uid);
    final userSnap = await userRef.get();

    if (userSnap.exists) {
      return userSnap.data()?['house_id'] as String? ?? defaultHouseId;
    }

    // Cria a casa padrão se ainda não existe
    final houseRef = _firestore.collection('houses').doc(defaultHouseId);
    final houseSnap = await houseRef.get();
    if (!houseSnap.exists) {
      await houseRef.set({
        'name': 'Casa Casoiko',
        'created_at': FieldValue.serverTimestamp(),
      });
    }

    // Cria o documento do usuário
    await userRef.set({
      'house_id': defaultHouseId,
      'name': user.displayName ?? 'Morador',
      'email': user.email ?? '',
      'photo_url': user.photoURL ?? '',
      'role': 'member',
      'created_at': FieldValue.serverTimestamp(),
    });

    return defaultHouseId;
  }

  /// Salva o token FCM do dispositivo no documento do usuario (array).
  /// Varios aparelhos por usuario ficam suportados.
  Future<void> saveFcmToken(String uid, String token) async {
    if (uid.isEmpty || token.isEmpty) return;
    await _firestore.collection('users').doc(uid).set({
      'fcm_tokens': FieldValue.arrayUnion([token]),
    }, SetOptions(merge: true));
  }

  /// Remove o token FCM (ex.: logout).
  Future<void> removeFcmToken(String uid, String token) async {
    if (uid.isEmpty || token.isEmpty) return;
    await _firestore.collection('users').doc(uid).set({
      'fcm_tokens': FieldValue.arrayRemove([token]),
    }, SetOptions(merge: true));
  }

  Future<HouseInfo> getHouse(String houseId) async {
    final snap = await _firestore.collection('houses').doc(houseId).get();
    if (!snap.exists) {
      return HouseInfo(id: houseId, name: 'Casa', description: '');
    }
    final data = snap.data() ?? {};
    return HouseInfo(
      id: houseId,
      name: data['name'] as String? ?? 'Casa',
      description: data['description'] as String? ?? '',
      createdAt: (data['created_at'] as Timestamp?)?.toDate(),
    );
  }

  Stream<HouseInfo> houseStream(String houseId) {
    return _firestore.collection('houses').doc(houseId).snapshots().map((snap) {
      final data = snap.data() ?? {};
      return HouseInfo(
        id: houseId,
        name: data['name'] as String? ?? 'Casa',
        description: data['description'] as String? ?? '',
        createdAt: (data['created_at'] as Timestamp?)?.toDate(),
      );
    });
  }

  Future<void> updateHouse({
    required String houseId,
    required String name,
    required String description,
  }) async {
    await _firestore.collection('houses').doc(houseId).set({
      'name': name.trim(),
      'description': description.trim(),
    }, SetOptions(merge: true));
  }

  /// Atualiza a função do membro (`admin` | `member`).
  Future<void> setMemberRole({
    required String uid,
    required String role,
  }) async {
    await _firestore.collection('users').doc(uid).set({
      'role': role,
    }, SetOptions(merge: true));
  }

  /// Remove o vínculo do usuário com a casa (some da lista de membros).
  Future<void> removeMemberFromHouse({
    required String uid,
    required String houseId,
  }) async {
    final ref = _firestore.collection('users').doc(uid);
    final snap = await ref.get();
    final current = snap.data()?['house_id'] as String?;
    if (current != houseId) return;
    await ref.update({
      'house_id': FieldValue.delete(),
      'role': 'member',
    });
  }
}

class HouseInfo {
  const HouseInfo({
    required this.id,
    required this.name,
    required this.description,
    this.createdAt,
  });

  final String id;
  final String name;
  final String description;
  final DateTime? createdAt;
}
