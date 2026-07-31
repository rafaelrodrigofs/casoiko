import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:natipsico/theme/app_colors.dart';

/// Status unificado do atendimento (Agenda = Sessões).
enum AppointmentStatus {
  pending,
  confirmed,
  done,
  missed,
  cancelled,
}

enum AppointmentType { online, presencial }

class Appointment {
  const Appointment({
    required this.id,
    required this.patientId,
    required this.patientName,
    required this.startsAt,
    this.durationMin = 50,
    this.type = AppointmentType.online,
    this.status = AppointmentStatus.pending,
    this.notes = '',
    this.evolution = '',
    this.mood = 2,
    this.nextPlan = '',
  });

  final String id;
  final String patientId;
  final String patientName;
  final DateTime startsAt;
  final int durationMin;
  final AppointmentType type;
  final AppointmentStatus status;
  final String notes;
  final String evolution;
  final int mood;
  final String nextPlan;

  String get typeLabel =>
      type == AppointmentType.online ? 'Online' : 'Presencial';

  String get statusLabel => switch (status) {
        AppointmentStatus.pending => 'Pendente',
        AppointmentStatus.confirmed => 'Confirmada',
        AppointmentStatus.done => 'Feita',
        AppointmentStatus.missed => 'Faltou',
        AppointmentStatus.cancelled => 'Cancelada',
      };

  Color get statusColor => switch (status) {
        AppointmentStatus.pending => AppColors.warning,
        AppointmentStatus.confirmed => AppColors.primary,
        AppointmentStatus.done => AppColors.primaryDark,
        AppointmentStatus.missed => const Color(0xFFC45C5C),
        AppointmentStatus.cancelled => AppColors.textMuted,
      };

  Color get statusBg => switch (status) {
        AppointmentStatus.pending => AppColors.warningSoft,
        AppointmentStatus.confirmed => AppColors.primarySoft,
        AppointmentStatus.done => AppColors.primarySoft,
        AppointmentStatus.missed => const Color(0xFFFDECEC),
        AppointmentStatus.cancelled => const Color(0xFFF0F0F0),
      };

  Appointment copyWith({
    String? id,
    String? patientId,
    String? patientName,
    DateTime? startsAt,
    int? durationMin,
    AppointmentType? type,
    AppointmentStatus? status,
    String? notes,
    String? evolution,
    int? mood,
    String? nextPlan,
  }) {
    return Appointment(
      id: id ?? this.id,
      patientId: patientId ?? this.patientId,
      patientName: patientName ?? this.patientName,
      startsAt: startsAt ?? this.startsAt,
      durationMin: durationMin ?? this.durationMin,
      type: type ?? this.type,
      status: status ?? this.status,
      notes: notes ?? this.notes,
      evolution: evolution ?? this.evolution,
      mood: mood ?? this.mood,
      nextPlan: nextPlan ?? this.nextPlan,
    );
  }

  factory Appointment.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? {};
    return Appointment(
      id: doc.id,
      patientId: (d['patientId'] as String?) ?? '',
      patientName: (d['patientName'] as String?) ?? '',
      startsAt: (d['startsAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      durationMin: (d['durationMin'] as int?) ?? 50,
      type: (d['type'] as String?) == 'presencial'
          ? AppointmentType.presencial
          : AppointmentType.online,
      status: _parseStatus(d['status'] as String?),
      notes: (d['notes'] as String?) ?? '',
      evolution: (d['evolution'] as String?) ?? '',
      mood: (d['mood'] as int?) ?? 2,
      nextPlan: (d['nextPlan'] as String?) ?? '',
    );
  }

  static AppointmentStatus _parseStatus(String? raw) {
    switch (raw) {
      case 'confirmed':
        return AppointmentStatus.confirmed;
      case 'cancelled':
        return AppointmentStatus.cancelled;
      case 'done':
        return AppointmentStatus.done;
      case 'missed':
        return AppointmentStatus.missed;
      default:
        return AppointmentStatus.pending;
    }
  }

  Map<String, dynamic> toMap() => {
        'patientId': patientId,
        'patientName': patientName,
        'startsAt': Timestamp.fromDate(startsAt),
        'durationMin': durationMin,
        'type': type == AppointmentType.presencial ? 'presencial' : 'online',
        'status': status.name,
        'notes': notes,
        'evolution': evolution,
        'mood': mood,
        'nextPlan': nextPlan,
      };
}
