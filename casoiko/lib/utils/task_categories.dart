import 'package:flutter/material.dart';

/// Categoria visual de tarefa da casa.
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
    id: 'routine',
    name: 'Rotina da manhã',
    icon: Icons.wb_sunny_outlined,
    color: Color(0xFFF59E0B),
  ),
  TaskCategory(
    id: 'cleaning',
    name: 'Limpeza',
    icon: Icons.cleaning_services_outlined,
    color: Color(0xFF3B82F6),
  ),
  TaskCategory(
    id: 'market',
    name: 'Mercado',
    icon: Icons.shopping_cart_outlined,
    color: Color(0xFF10B981),
  ),
  TaskCategory(
    id: 'work',
    name: 'Trabalho',
    icon: Icons.work_outline,
    color: Color(0xFF6366F1),
  ),
  TaskCategory(
    id: 'study',
    name: 'Estudos',
    icon: Icons.menu_book_outlined,
    color: Color(0xFF8B5CF6),
  ),
  TaskCategory(
    id: 'exercise',
    name: 'Exercícios',
    icon: Icons.fitness_center_outlined,
    color: Color(0xFFEF4444),
  ),
  TaskCategory(
    id: 'health',
    name: 'Saúde',
    icon: Icons.local_hospital_outlined,
    color: Color(0xFFEC4899),
  ),
  TaskCategory(
    id: 'appointment',
    name: 'Compromissos',
    icon: Icons.event_outlined,
    color: Color(0xFF14B8A6),
  ),
  TaskCategory(
    id: 'growth',
    name: 'Desenvolvimento',
    icon: Icons.auto_stories_outlined,
    color: Color(0xFF0EA5E9),
  ),
  TaskCategory(
    id: 'leisure',
    name: 'Lazer',
    icon: Icons.sports_esports_outlined,
    color: Color(0xFFA855F7),
  ),
];

TaskCategory taskCategoryFor(String id) {
  return kTaskCategories.firstWhere(
    (c) => c.id == id,
    orElse: () => kTaskCategories.first,
  );
}

/// Ordem dos períodos na tela.
const kTaskPeriodOrder = ['Manhã', 'Tarde', 'Noite', 'Sem horário'];
