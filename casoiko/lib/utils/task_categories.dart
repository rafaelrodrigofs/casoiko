import 'package:flutter/material.dart';

/// Categoria de tarefa com ícone e cor para UI visual.
class TaskCategory {
  const TaskCategory({
    required this.id,
    required this.name,
    required this.icon,
    required this.color,
  });

  final String id;
  final String name;
  final IconData icon;
  final Color color;
}

const kTaskCategories = [
  TaskCategory(
    id: 'rotina',
    name: 'Rotina da manhã',
    icon: Icons.wb_sunny_outlined,
    color: Color(0xFFF59E0B),
  ),
  TaskCategory(
    id: 'limpeza',
    name: 'Limpeza',
    icon: Icons.cleaning_services_outlined,
    color: Color(0xFF3B82F6),
  ),
  TaskCategory(
    id: 'mercado',
    name: 'Mercado',
    icon: Icons.shopping_cart_outlined,
    color: Color(0xFF10B981),
  ),
  TaskCategory(
    id: 'trabalho',
    name: 'Trabalho',
    icon: Icons.work_outline,
    color: Color(0xFF6366F1),
  ),
  TaskCategory(
    id: 'estudos',
    name: 'Estudos',
    icon: Icons.school_outlined,
    color: Color(0xFF8B5CF6),
  ),
  TaskCategory(
    id: 'exercicios',
    name: 'Exercícios',
    icon: Icons.fitness_center_outlined,
    color: Color(0xFFEF4444),
  ),
  TaskCategory(
    id: 'saude',
    name: 'Saúde',
    icon: Icons.local_hospital_outlined,
    color: Color(0xFFEC4899),
  ),
  TaskCategory(
    id: 'compromissos',
    name: 'Compromissos',
    icon: Icons.event_outlined,
    color: Color(0xFF14B8A6),
  ),
  TaskCategory(
    id: 'desenvolvimento',
    name: 'Desenvolvimento pessoal',
    icon: Icons.auto_stories_outlined,
    color: Color(0xFF0EA5E9),
  ),
  TaskCategory(
    id: 'lazer',
    name: 'Lazer',
    icon: Icons.sports_esports_outlined,
    color: Color(0xFFA855F7),
  ),
];

TaskCategory taskCategoryFor(String id) {
  for (final category in kTaskCategories) {
    if (category.id == id) return category;
  }
  return kTaskCategories.first;
}
