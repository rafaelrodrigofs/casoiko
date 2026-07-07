import 'package:flutter/material.dart';
import 'package:casoiko/theme/app_colors.dart';

import '../../models/finance_transaction.dart';
import '../../models/house_task.dart';
import '../../utils/task_categories.dart';

class TaskInput {
  const TaskInput({
    required this.title,
    required this.description,
    required this.category,
    required this.assigneeUid,
    required this.assigneeName,
    required this.time,
    required this.priority,
    required this.repeat,
    required this.weekdays,
  });

  final String title;
  final String description;
  final String category;
  final String assigneeUid;
  final String assigneeName;
  final String time;
  final int priority;
  final String repeat;
  final List<int> weekdays;
}

class TaskFormSheet extends StatefulWidget {
  const TaskFormSheet({
    super.key,
    required this.members,
    required this.currentUid,
    this.task,
  });

  final List<HouseMember> members;
  final String currentUid;
  final HouseTask? task;

  @override
  State<TaskFormSheet> createState() => _TaskFormSheetState();
}

class _TaskFormSheetState extends State<TaskFormSheet> {
  late final TextEditingController _titleController;
  late final TextEditingController _descriptionController;
  late String _category;
  late String _assigneeUid;
  late String _time;
  late int _priority;
  late String _repeat;
  late Set<int> _weekdays;

  bool get _isEditing => widget.task != null;

  static const _weekdayLabels = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

  @override
  void initState() {
    super.initState();
    final task = widget.task;
    _titleController = TextEditingController(text: task?.title ?? '');
    _descriptionController =
        TextEditingController(text: task?.description ?? '');
    _category = task?.category ?? kTaskCategories.first.id;
    _time = task?.time ?? '';
    _priority = task?.priority ?? 0;
    _repeat = task?.repeat ?? HouseTask.repeatNone;
    _weekdays = task != null ? task.weekdays.toSet() : {DateTime.now().weekday};

    if (task != null) {
      _assigneeUid = task.assigneeUid;
    } else if (widget.members.any((m) => m.uid == widget.currentUid)) {
      _assigneeUid = widget.currentUid;
    } else {
      _assigneeUid =
          widget.members.isNotEmpty ? widget.members.first.uid : '';
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _pickTime() async {
    TimeOfDay initial = const TimeOfDay(hour: 8, minute: 0);
    if (_time.isNotEmpty) {
      final parts = _time.split(':');
      if (parts.length >= 2) {
        initial = TimeOfDay(
          hour: int.tryParse(parts[0]) ?? 8,
          minute: int.tryParse(parts[1]) ?? 0,
        );
      }
    }
    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
    );
    if (picked != null) {
      setState(() {
        _time =
            '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
      });
    }
  }

  void _submit() {
    final title = _titleController.text.trim();
    if (title.isEmpty || _assigneeUid.isEmpty) return;

    final member = widget.members.firstWhere(
      (m) => m.uid == _assigneeUid,
      orElse: () =>
          const HouseMember(uid: '', name: 'Morador', photoUrl: ''),
    );

    Navigator.of(context).pop(
      TaskInput(
        title: title,
        description: _descriptionController.text.trim(),
        category: _category,
        assigneeUid: member.uid,
        assigneeName: member.name,
        time: _time,
        priority: _priority,
        repeat: _repeat,
        weekdays: _weekdays.toList()..sort(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.9,
        ),
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                _isEditing ? 'Editar tarefa' : 'Nova tarefa',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _titleController,
                autofocus: !_isEditing,
                textCapitalization: TextCapitalization.sentences,
                decoration: _decoration('Ex: Lavar louça, Karatê...'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _descriptionController,
                textCapitalization: TextCapitalization.sentences,
                maxLines: 2,
                decoration: _decoration(
                  'Detalhes (opcional)',
                  label: 'Descrição',
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Categoria',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: kTaskCategories.map((category) {
                  final selected = category.id == _category;
                  return GestureDetector(
                    onTap: () => setState(() => _category = category.id),
                    child: Container(
                      width: 72,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: selected
                            ? category.color.withValues(alpha: 0.15)
                            : AppColors.surfaceMuted,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: selected
                              ? category.color
                              : Colors.transparent,
                          width: 2,
                        ),
                      ),
                      child: Column(
                        children: [
                          Icon(
                            category.icon,
                            size: 26,
                            color: category.color,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            category.name.split(' ').first,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w600,
                              color: selected
                                  ? category.color
                                  : AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              const Text(
                'Responsável',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 12,
                runSpacing: 8,
                children: widget.members.map((member) {
                  final selected = member.uid == _assigneeUid;
                  return GestureDetector(
                    onTap: () => setState(() => _assigneeUid = member.uid),
                    child: Column(
                      children: [
                        CircleAvatar(
                          radius: 26,
                          backgroundColor: selected
                              ? AppColors.primary.withValues(alpha: 0.15)
                              : AppColors.surfaceMuted,
                          backgroundImage: member.photoUrl.isNotEmpty
                              ? NetworkImage(member.photoUrl)
                              : null,
                          child: member.photoUrl.isEmpty
                              ? Text(
                                  member.firstName.isNotEmpty
                                      ? member.firstName[0]
                                      : '?',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: selected
                                        ? AppColors.primary
                                        : AppColors.textSecondary,
                                  ),
                                )
                              : null,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          member.firstName,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight:
                                selected ? FontWeight.w700 : FontWeight.w500,
                            color: selected
                                ? AppColors.primary
                                : AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: _pickTime,
                      borderRadius: BorderRadius.circular(12),
                      child: InputDecorator(
                        decoration: _decoration('', label: 'Horário'),
                        child: Text(
                          _time.isEmpty ? 'Sem horário' : _time,
                          style: const TextStyle(fontSize: 15),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: DropdownButtonFormField<int>(
                      initialValue: _priority,
                      decoration: _decoration('', label: 'Prioridade'),
                      items: const [
                        DropdownMenuItem(value: 0, child: Text('Normal')),
                        DropdownMenuItem(value: 1, child: Text('Alta')),
                      ],
                      onChanged: (v) => setState(() => _priority = v ?? 0),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              const Text(
                'Repetição',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(
                    value: HouseTask.repeatNone,
                    label: Text('Uma vez'),
                  ),
                  ButtonSegment(
                    value: HouseTask.repeatDaily,
                    label: Text('Diária'),
                  ),
                  ButtonSegment(
                    value: HouseTask.repeatWeekly,
                    label: Text('Semanal'),
                  ),
                ],
                selected: {_repeat},
                onSelectionChanged: (value) =>
                    setState(() => _repeat = value.first),
              ),
              if (_repeat == HouseTask.repeatWeekly) ...[
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: List.generate(7, (index) {
                    final weekday = index + 1;
                    final selected = _weekdays.contains(weekday);
                    return GestureDetector(
                      onTap: () {
                        setState(() {
                          if (selected) {
                            _weekdays.remove(weekday);
                          } else {
                            _weekdays.add(weekday);
                          }
                        });
                      },
                      child: CircleAvatar(
                        radius: 18,
                        backgroundColor: selected
                            ? AppColors.primary
                            : AppColors.surfaceMuted,
                        child: Text(
                          _weekdayLabels[index],
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: selected
                                ? Colors.white
                                : AppColors.textSecondary,
                          ),
                        ),
                      ),
                    );
                  }),
                ),
              ],
              if (_time.isNotEmpty) ...[
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => setState(() => _time = ''),
                  child: const Text('Remover horário'),
                ),
              ],
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton(
                  onPressed: _submit,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: Text(
                    _isEditing ? 'Salvar' : 'Criar tarefa',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _decoration(String hint, {String? label}) {
    return InputDecoration(
      hintText: hint.isEmpty ? null : hint,
      labelText: label,
      filled: true,
      fillColor: AppColors.surfaceMuted,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      ),
    );
  }
}
