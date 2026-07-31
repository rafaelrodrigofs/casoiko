import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/appointment.dart';
import '../utils/firestore_paths.dart';
import '../utils/format.dart';

class AppointmentService {
  AppointmentService(this.uid);

  final String uid;

  CollectionReference<Map<String, dynamic>> get _col =>
      FirestorePaths.appointments(uid);

  Future<Appointment?> getById(String id) async {
    final snap = await _col.doc(id).get();
    if (!snap.exists) return null;
    return Appointment.fromDoc(snap);
  }

  Stream<List<Appointment>> watchDay(DateTime day) {
    final start = startOfDay(day);
    final end = endOfDay(day);
    return _col
        .where('startsAt', isGreaterThanOrEqualTo: Timestamp.fromDate(start))
        .where('startsAt', isLessThanOrEqualTo: Timestamp.fromDate(end))
        .orderBy('startsAt')
        .snapshots()
        .map((snap) => snap.docs.map(Appointment.fromDoc).toList());
  }

  Stream<List<Appointment>> watchMonth(DateTime month) {
    final start = startOfMonth(month);
    final end = endOfMonth(month);
    return _col
        .where('startsAt', isGreaterThanOrEqualTo: Timestamp.fromDate(start))
        .where('startsAt', isLessThanOrEqualTo: Timestamp.fromDate(end))
        .orderBy('startsAt')
        .snapshots()
        .map((snap) => snap.docs.map(Appointment.fromDoc).toList());
  }

  Stream<List<Appointment>> watchAll() {
    return _col
        .orderBy('startsAt', descending: true)
        .snapshots()
        .map((snap) => snap.docs.map(Appointment.fromDoc).toList());
  }

  Stream<List<Appointment>> watchForPatient(String patientId) {
    return _col
        .where('patientId', isEqualTo: patientId)
        .orderBy('startsAt', descending: true)
        .snapshots()
        .map((snap) => snap.docs.map(Appointment.fromDoc).toList());
  }

  Future<int> countForPatient(String patientId) async {
    final snap = await _col.where('patientId', isEqualTo: patientId).get();
    return snap.docs.length;
  }

  /// Só sessões efetivamente realizadas (status Feita).
  Future<int> countDoneForPatient(String patientId) async {
    final snap = await _col
        .where('patientId', isEqualTo: patientId)
        .where('status', isEqualTo: AppointmentStatus.done.name)
        .get();
    return snap.docs.length;
  }

  Future<int> countDoneInMonth(DateTime month) async {
    final list = await watchMonth(month).first;
    return list.where((a) => a.status == AppointmentStatus.done).length;
  }

  Future<Appointment?> latestDoneForPatient(String patientId) async {
    final list = await watchForPatient(patientId).first;
    for (final a in list) {
      if (a.status == AppointmentStatus.done) return a;
    }
    return null;
  }

  Future<String> create(Appointment appt) async {
    final ref = await _col.add(appt.toMap());
    return ref.id;
  }

  Future<void> update(Appointment appt) async {
    await _col.doc(appt.id).update(appt.toMap());
  }

  Future<void> delete(String id) async {
    await _col.doc(id).delete();
  }
}
