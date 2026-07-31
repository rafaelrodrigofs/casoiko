import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../config/google_auth_config.dart';
import '../utils/firestore_paths.dart';

class AuthService {
  AuthService({
    FirebaseAuth? firebaseAuth,
    GoogleSignIn? googleSignIn,
  })  : _firebaseAuth = firebaseAuth ?? FirebaseAuth.instance,
        _googleSignIn = googleSignIn ?? GoogleSignIn.instance;

  final FirebaseAuth _firebaseAuth;
  final GoogleSignIn _googleSignIn;

  Stream<User?> get authStateChanges => _firebaseAuth.authStateChanges();

  User? get currentUser => _firebaseAuth.currentUser;

  String? get uid => currentUser?.uid;

  Future<void> initialize() async {
    await _googleSignIn.initialize(
      serverClientId: kGoogleWebClientId,
    );
  }

  Future<UserCredential> signInWithGoogle() async {
    final GoogleSignInAccount googleUser = await _googleSignIn.authenticate();
    final GoogleSignInAuthentication googleAuth = googleUser.authentication;

    if (googleAuth.idToken == null) {
      throw FirebaseAuthException(
        code: 'missing-id-token',
        message: 'O Google não retornou o token de autenticação.',
      );
    }

    final email = googleUser.email.toLowerCase();
    // Whitelist vazia ou só placeholder = modo desenvolvimento (libera tudo).
    final effectiveList = kAllowedEmails
        .map((e) => e.toLowerCase())
        .where((e) => !e.contains('consultorio.com') && !e.contains('REPLACE'))
        .toList();
    if (effectiveList.isNotEmpty && !effectiveList.contains(email)) {
      await _googleSignIn.signOut();
      throw FirebaseAuthException(
        code: 'email-not-allowed',
        message: 'Este e-mail não está autorizado a usar o NatiPsico.',
      );
    }

    final credential = GoogleAuthProvider.credential(
      idToken: googleAuth.idToken,
    );

    final result = await _firebaseAuth.signInWithCredential(credential);
    await _ensureProfessionalDoc(result.user!);
    debugPrint('Google sign-in OK for ${googleUser.email}');
    return result;
  }

  Future<void> _ensureProfessionalDoc(User user) async {
    final ref = FirestorePaths.professional(user.uid);
    final snap = await ref.get();
    if (snap.exists) return;
    await ref.set({
      'name': user.displayName ?? 'Profissional',
      'email': user.email ?? '',
      'photoUrl': user.photoURL,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> signOut() async {
    await Future.wait([
      _firebaseAuth.signOut(),
      _googleSignIn.signOut(),
    ]);
  }
}
