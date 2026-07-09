import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:casoiko/theme/app_colors.dart';
import 'package:image_picker/image_picker.dart';

import '../../models/finance_transaction.dart';
import '../../models/house_task.dart';
import '../../models/task_repeat_config.dart';
import '../../utils/media_compress.dart';
import '../../utils/task_categories.dart';
import 'repeat_config_sheet.dart';
import 'widgets/proof_video_player.dart';

class TaskInput {
  const TaskInput({
    required this.title,
    required this.description,
    required this.categoryId,
    required this.assigneeUid,
    required this.assigneeName,
    required this.time,
    required this.priority,
    required this.repeatConfig,
    required this.subtasks,
  });

  final String title;
  final String description;
  final String categoryId;
  final String assigneeUid;
  final String assigneeName;
  final String time;
  final int priority;
  final TaskRepeatConfig repeatConfig;
  final List<TaskSubtask> subtasks;
}

/// Resultado ao concluir uma tarefa (prova opcional).
class TaskCompleteInput {
  const TaskCompleteInput({
    this.proofPhotoBase64 = '',
    this.proofVideoBase64 = '',
  });

  final String proofPhotoBase64;
  final String proofVideoBase64;
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
  late final TextEditingController _timeController;
  late String _categoryId;
  late String _assigneeUid;
  late int _priority;
  late TaskRepeatConfig _repeatConfig;
  late List<TaskSubtask> _subtasks;
  final _subtaskController = TextEditingController();

  bool get _isEditing => widget.task != null;

  @override
  void initState() {
    super.initState();
    final task = widget.task;
    _titleController = TextEditingController(text: task?.title ?? '');
    _timeController = TextEditingController(text: task?.time ?? '');
    _categoryId = task?.categoryId ?? kTaskCategories.first.id;
    _assigneeUid = task?.assigneeUid ??
        (widget.members.any((m) => m.uid == widget.currentUid)
            ? widget.currentUid
            : (widget.members.isNotEmpty ? widget.members.first.uid : ''));
    _priority = task?.priority ?? 0;
    _repeatConfig = task != null
        ? TaskRepeatConfig.fromHouseTask(task)
        : TaskRepeatConfig();
    _subtasks = List<TaskSubtask>.from(task?.subtasks ?? []);
  }

  @override
  void dispose() {
    _titleController.dispose();
    _timeController.dispose();
    _subtaskController.dispose();
    super.dispose();
  }

  void _addSubtask() {
    final title = _subtaskController.text.trim();
    if (title.isEmpty) return;
    setState(() {
      _subtasks = [
        ..._subtasks,
        TaskSubtask(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          title: title,
          done: false,
        ),
      ];
      _subtaskController.clear();
    });
  }

  void _removeSubtask(String id) {
    setState(() {
      _subtasks = _subtasks.where((s) => s.id != id).toList();
    });
  }

  Future<void> _pickTime() async {
    final parts = _timeController.text.split(':');
    final initial = TimeOfDay(
      hour: parts.length >= 2 ? int.tryParse(parts[0]) ?? 8 : 8,
      minute: parts.length >= 2 ? int.tryParse(parts[1]) ?? 0 : 0,
    );
    final picked = await showTimePicker(context: context, initialTime: initial);
    if (picked != null) {
      _timeController.text =
          '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
      setState(() {});
    }
  }

  Future<void> _openRepeatConfig() async {
    final anchor = widget.task?.createdAt ?? DateTime.now();
    final result = await RepeatConfigSheet.open(
      context,
      initial: _repeatConfig,
      anchorDate: anchor,
    );
    if (result != null) {
      setState(() => _repeatConfig = result);
    }
  }

  void _submit() {
    final title = _titleController.text.trim();
    if (title.isEmpty || _assigneeUid.isEmpty) return;

    final member = widget.members.firstWhere(
      (m) => m.uid == _assigneeUid,
      orElse: () => const HouseMember(uid: '', name: 'Morador', photoUrl: ''),
    );

    Navigator.of(context).pop(
      TaskInput(
        title: title,
        description: '',
        categoryId: _categoryId,
        assigneeUid: member.uid,
        assigneeName: member.name,
        time: _timeController.text.trim(),
        priority: _priority,
        repeatConfig: _repeatConfig,
        subtasks: _subtasks,
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
          maxHeight: MediaQuery.of(context).size.height * 0.92,
        ),
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
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
                decoration: _decoration('O que precisa ser feito?'),
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
              const SizedBox(height: 8),
              SizedBox(
                height: 76,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: kTaskCategories.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (context, index) {
                    final cat = kTaskCategories[index];
                    final selected = cat.id == _categoryId;
                    return InkWell(
                      onTap: () => setState(() => _categoryId = cat.id),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        width: 72,
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          color: selected
                              ? cat.color.withValues(alpha: 0.15)
                              : AppColors.surfaceMuted,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: selected ? cat.color : Colors.transparent,
                            width: 2,
                          ),
                        ),
                        child: Column(
                          children: [
                            Icon(cat.icon, color: cat.color, size: 26),
                            const SizedBox(height: 4),
                            Text(
                              cat.name.split(' ').first,
                              textAlign: TextAlign.center,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w600,
                                color: selected
                                    ? cat.color
                                    : AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Quem vai fazer?',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                height: 92,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: widget.members.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 12),
                  itemBuilder: (context, index) {
                    final member = widget.members[index];
                    final selected = member.uid == _assigneeUid;
                    return InkWell(
                      onTap: () => setState(() => _assigneeUid = member.uid),
                      borderRadius: BorderRadius.circular(20),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: selected
                              ? AppColors.primary.withValues(alpha: 0.12)
                              : AppColors.surfaceMuted,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: selected
                                ? AppColors.primary
                                : AppColors.border,
                            width: selected ? 2.5 : 1,
                          ),
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Stack(
                              clipBehavior: Clip.none,
                              children: [
                                CircleAvatar(
                                  radius: 24,
                                  backgroundColor: selected
                                      ? AppColors.primary.withValues(alpha: 0.2)
                                      : Colors.white,
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
                                            fontSize: 16,
                                            color: selected
                                                ? AppColors.primary
                                                : AppColors.textSecondary,
                                          ),
                                        )
                                      : null,
                                ),
                                if (selected)
                                  Positioned(
                                    right: -2,
                                    bottom: -2,
                                    child: Container(
                                      width: 20,
                                      height: 20,
                                      decoration: const BoxDecoration(
                                        color: AppColors.primary,
                                        shape: BoxShape.circle,
                                      ),
                                      child: const Icon(
                                        Icons.check,
                                        size: 12,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              member.firstName,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: selected
                                    ? AppColors.primary
                                    : AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 16),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _pickerButton(
                    label: 'Horário',
                    icon: Icons.schedule_rounded,
                    value: _timeController.text.isEmpty
                        ? 'Sem horário'
                        : _timeController.text,
                    onTap: _pickTime,
                  ),
                  const SizedBox(width: 12),
                  _pickerButton(
                    label: 'Repetir',
                    icon: Icons.repeat_rounded,
                    value: _repeatConfig.summaryShort(),
                    onTap: _openRepeatConfig,
                  ),
                ],
              ),
              const SizedBox(height: 12),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Prioridade alta'),
                value: _priority > 0,
                activeThumbColor: AppColors.primary,
                onChanged: (v) => setState(() => _priority = v ? 1 : 0),
              ),
              const SizedBox(height: 8),
              const Text(
                'Subtarefas',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _subtaskController,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: _decoration('Ex: Separar louça suja'),
                      onSubmitted: (_) => _addSubtask(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: _addSubtask,
                    icon: const Icon(Icons.add),
                    style: IconButton.styleFrom(
                      backgroundColor: AppColors.primary,
                    ),
                  ),
                ],
              ),
              if (_subtasks.isNotEmpty) ...[
                const SizedBox(height: 8),
                ..._subtasks.map(
                  (s) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.subdirectory_arrow_right,
                        size: 20, color: AppColors.textSecondary),
                    title: Text(s.title),
                    trailing: IconButton(
                      icon: Icon(Icons.close, color: Colors.red[400], size: 20),
                      onPressed: () => _removeSubtask(s.id),
                    ),
                  ),
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

  Widget _pickerButton({
    required String label,
    required IconData icon,
    required String value,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 6),
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary,
              ),
            ),
          ),
          Material(
            color: AppColors.primarySoft,
            borderRadius: BorderRadius.circular(12),
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(12),
              child: Container(
                height: 48,
                padding: const EdgeInsets.symmetric(horizontal: 10),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.primary.withValues(alpha: 0.35),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(icon, size: 20, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        value,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Icon(
                      Icons.chevron_right_rounded,
                      size: 18,
                      color: AppColors.primary.withValues(alpha: 0.7),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
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

/// Sheet para concluir tarefa com prova opcional (foto ou vídeo).
class TaskCompleteSheet extends StatefulWidget {
  const TaskCompleteSheet({super.key, required this.taskTitle});

  final String taskTitle;

  @override
  State<TaskCompleteSheet> createState() => _TaskCompleteSheetState();
}

class _TaskCompleteSheetState extends State<TaskCompleteSheet> {
  String _proofPhotoBase64 = '';
  String _proofVideoBase64 = '';
  bool _compressingVideo = false;

  Future<void> _pickPhoto() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Tirar foto'),
              onTap: () => Navigator.of(context).pop(ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Escolher da galeria'),
              onTap: () => Navigator.of(context).pop(ImageSource.gallery),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (source == null) return;

    final picked = await ImagePicker().pickImage(
      source: source,
      maxWidth: 600,
      maxHeight: 600,
      imageQuality: 65,
    );
    if (picked == null) return;

    final bytes = await picked.readAsBytes();
    setState(() {
      _proofPhotoBase64 = base64Encode(bytes);
      _proofVideoBase64 = '';
    });
  }

  Future<void> _pickVideo() async {
    setState(() => _compressingVideo = true);

    final encoded = await pickAndCompressVideo(context);

    if (!mounted) return;
    setState(() => _compressingVideo = false);

    if (encoded == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Não foi possível processar o vídeo. '
            'Tente um clipe mais curto.',
          ),
        ),
      );
      return;
    }

    setState(() {
      _proofVideoBase64 = encoded;
      _proofPhotoBase64 = '';
    });
  }

  void _submit() {
    Navigator.of(context).pop(
      TaskCompleteInput(
        proofPhotoBase64: _proofPhotoBase64,
        proofVideoBase64: _proofVideoBase64,
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
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
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
              'Concluir "${widget.taskTitle}"?',
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Prova opcional: foto ou vídeo curto.',
              style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _pickPhoto,
                    icon: const Icon(Icons.photo_camera_outlined),
                    label: const Text('Foto'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _compressingVideo ? null : _pickVideo,
                    icon: _compressingVideo
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.videocam_outlined),
                    label: Text(
                      _compressingVideo ? 'Comprimindo...' : 'Vídeo',
                    ),
                  ),
                ),
              ],
            ),
            if (_proofPhotoBase64.isNotEmpty) ...[
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.memory(
                  base64Decode(_proofPhotoBase64),
                  height: 120,
                  width: double.infinity,
                  fit: BoxFit.cover,
                ),
              ),
            ],
            if (_proofVideoBase64.isNotEmpty) ...[
              const SizedBox(height: 12),
              ProofVideoPlayer(videoBase64: _proofVideoBase64, height: 180),
            ],
            const SizedBox(height: 20),
            SizedBox(
              height: 52,
              child: FilledButton.icon(
                onPressed: _submit,
                icon: const Icon(Icons.check_circle_outline),
                label: const Text(
                  'Marcar como feita',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
