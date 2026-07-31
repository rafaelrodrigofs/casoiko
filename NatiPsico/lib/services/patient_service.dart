import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/patient.dart';
import '../utils/firestore_paths.dart';

class PatientService {
  PatientService(this.uid);

  final String uid;

  CollectionReference<Map<String, dynamic>> get _col =>
      FirestorePaths.patients(uid);

  Stream<List<Patient>> watchAll({PatientStatus? status}) {
    Query<Map<String, dynamic>> q = _col.orderBy('name');
    if (status != null) {
      q = _col
          .where(
            'status',
            isEqualTo: status == PatientStatus.archived ? 'archived' : 'active',
          )
          .orderBy('name');
    }
    return q.snapshots().map(
          (snap) => snap.docs.map(Patient.fromDoc).toList(),
        );
  }

  Future<Patient?> getById(String id) async {
    final doc = await _col.doc(id).get();
    if (!doc.exists) return null;
    return Patient.fromDoc(doc);
  }

  Future<String> create(Patient patient) async {
    final ref = await _col.add({
      ...patient.toMap(),
      'createdAt': FieldValue.serverTimestamp(),
      'startedAt': patient.startedAt != null
          ? Timestamp.fromDate(patient.startedAt!)
          : FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  Future<void> update(Patient patient) async {
    await _col.doc(patient.id).update(patient.toMap());
  }

  Future<void> setArchived(String id, bool archived) async {
    await _col.doc(id).update({
      'status': archived ? 'archived' : 'active',
    });
  }

  Future<int> countActive() async {
    final snap = await _col.where('status', isEqualTo: 'active').get();
    return snap.docs.length;
  }
}
