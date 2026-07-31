import 'package:cloud_firestore/cloud_firestore.dart';

enum PatientStatus { active, archived }

class Patient {
  const Patient({
    required this.id,
    required this.name,
    this.phone = '',
    this.email = '',
    this.notes = '',
    this.modality = 'online',
    this.frequency = 'Semanal',
    this.status = PatientStatus.active,
    this.age,
    this.startedAt,
    this.createdAt,
  });

  final String id;
  final String name;
  final String phone;
  final String email;
  final String notes;
  final String modality;
  final String frequency;
  final PatientStatus status;
  final int? age;
  final DateTime? startedAt;
  final DateTime? createdAt;

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    if (parts.length == 1) {
      return parts.first.substring(0, 1).toUpperCase();
    }
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
        .toUpperCase();
  }

  factory Patient.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? {};
    return Patient(
      id: doc.id,
      name: (d['name'] as String?) ?? '',
      phone: (d['phone'] as String?) ?? '',
      email: (d['email'] as String?) ?? '',
      notes: (d['notes'] as String?) ?? '',
      modality: (d['modality'] as String?) ?? 'online',
      frequency: (d['frequency'] as String?) ?? 'Semanal',
      status: (d['status'] as String?) == 'archived'
          ? PatientStatus.archived
          : PatientStatus.active,
      age: d['age'] as int?,
      startedAt: (d['startedAt'] as Timestamp?)?.toDate(),
      createdAt: (d['createdAt'] as Timestamp?)?.toDate(),
    );
  }

  Map<String, dynamic> toMap() => {
        'name': name,
        'phone': phone,
        'email': email,
        'notes': notes,
        'modality': modality,
        'frequency': frequency,
        'status': status == PatientStatus.archived ? 'archived' : 'active',
        'age': age,
        'startedAt': startedAt != null ? Timestamp.fromDate(startedAt!) : null,
        'createdAt': createdAt != null
            ? Timestamp.fromDate(createdAt!)
            : FieldValue.serverTimestamp(),
      };

  Patient copyWith({
    String? name,
    String? phone,
    String? email,
    String? notes,
    String? modality,
    String? frequency,
    PatientStatus? status,
    int? age,
    DateTime? startedAt,
  }) {
    return Patient(
      id: id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      notes: notes ?? this.notes,
      modality: modality ?? this.modality,
      frequency: frequency ?? this.frequency,
      status: status ?? this.status,
      age: age ?? this.age,
      startedAt: startedAt ?? this.startedAt,
      createdAt: createdAt,
    );
  }
}
