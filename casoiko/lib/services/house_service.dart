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
}
