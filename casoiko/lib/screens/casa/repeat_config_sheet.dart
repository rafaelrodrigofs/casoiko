import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../../models/house_task.dart';
import '../../models/task_repeat_config.dart';
import '../../theme/app_colors.dart';

/// Modal de configuração de repetição (frequência + duração).
class RepeatConfigSheet extends StatefulWidget {
  const RepeatConfigSheet({
    super.key,
    required this.initial,
    this.anchorDate,
  });

  final TaskRepeatConfig initial;
  final DateTime? anchorDate;

  static Future<TaskRepeatConfig?> open(
    BuildContext context, {
    required TaskRepeatConfig initial,
    DateTime? anchorDate,
  }) {
    return Navigator.of(context).push<TaskRepeatConfig>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => RepeatConfigSheet(
          initial: initial,
          anchorDate: anchorDate,
        ),
      ),
    );
  }

  @override
  State<RepeatConfigSheet> createState() => _RepeatConfigSheetState();
}

class _RepeatConfigSheetState extends State<RepeatConfigSheet> {
  late TaskRepeatConfig _config;
  late final DateTime _anchor;
  late final TextEditingController _intervalController;
  late final TextEditingController _durationCountController;

  bool _showMonthDays = false;
  bool _showYearMonths = false;
  bool _showYearDays = false;

  @override
  void initState() {
    super.initState();
    _config = widget.initial;
    _anchor = widget.anchorDate ?? DateTime.now();
    _intervalController = TextEditingController(text: '${_config.interval}');
    _durationCountController = TextEditingController(
      text: '${_config.durationCount ?? 10}',
    );
    _showMonthDays = _config.monthDays.isNotEmpty;
    _showYearMonths = _config.yearMonths.isNotEmpty;
    _showYearDays = _config.monthDays.isNotEmpty;
  }

  @override
  void dispose() {
    _intervalController.dispose();
    _durationCountController.dispose();
    super.dispose();
  }

  void _apply(TaskRepeatConfig next) {
    if (next.interval != _config.interval) {
      _intervalController.text = '${next.interval}';
    }
    if (next.durationCount != _config.durationCount &&
        next.durationCount != null) {
      _durationCountController.text = '${next.durationCount}';
    }
    setState(() => _config = next);
  }

  void _selectType(String type) {
    var next = _config.copyWith(type: type);
    if (type == HouseTask.repeatWeekly && next.weekdays.isEmpty) {
      next = next.copyWith(weekdays: [_anchor.weekday]);
    }
    if (type == HouseTask.repeatMonthly && next.monthDays.isEmpty) {
      next = next.copyWith(monthDays: [_anchor.day]);
      _showMonthDays = true;
    }
    if (type == HouseTask.repeatYearly) {
      if (next.yearMonths.isEmpty) {
        next = next.copyWith(yearMonths: [_anchor.month]);
        _showYearMonths = true;
      }
      if (next.monthDays.isEmpty) {
        next = next.copyWith(monthDays: [_anchor.day]);
        _showYearDays = true;
      }
    }
    if (type == HouseTask.repeatNone) {
      next = next.copyWith(durationType: TaskRepeatConfig.durationForever);
    }
    _apply(next);
  }

  void _setInterval(int value) {
    _apply(_config.copyWith(interval: value.clamp(1, 999)));
  }

  void _toggleWeekday(int weekday) {
    final list = [..._config.weekdays];
    if (list.contains(weekday)) {
      if (list.length > 1) list.remove(weekday);
    } else {
      list.add(weekday);
      list.sort();
    }
    _apply(_config.copyWith(weekdays: list));
  }

  void _toggleMonthDay(int day) {
    final list = [..._config.monthDays];
    if (list.contains(day)) {
      if (list.length > 1) list.remove(day);
    } else {
      list.add(day);
      list.sort();
    }
    _apply(_config.copyWith(monthDays: list));
  }

  void _toggleYearMonth(int month) {
    final list = [..._config.yearMonths];
    if (list.contains(month)) {
      if (list.length > 1) list.remove(month);
    } else {
      list.add(month);
      list.sort();
    }
    _apply(_config.copyWith(yearMonths: list));
  }

  void _setDurationType(String type) {
    var next = _config.copyWith(
      durationType: type,
      clearDurationCount: type != TaskRepeatConfig.durationTypeCount,
      clearDurationUntil: type != TaskRepeatConfig.durationTypeUntil,
    );
    if (type == TaskRepeatConfig.durationTypeCount && next.durationCount == null) {
      next = next.copyWith(durationCount: 10);
    }
    if (type == TaskRepeatConfig.durationTypeUntil && next.durationUntil == null) {
      next = next.copyWith(
        durationUntil: _anchor.add(const Duration(days: 30)),
      );
    }
    _apply(next);
  }

  Future<void> _pickUntilDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _config.durationUntil ?? _anchor,
      firstDate: _anchor,
      lastDate: DateTime(_anchor.year + 10),
      locale: const Locale('pt', 'BR'),
    );
    if (picked != null) {
      _apply(_config.copyWith(durationUntil: picked));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context, _config),
        ),
        title: const Text(
          'Repetir',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
        children: [
          Text(
            _config.summarySentence(anchor: _anchor),
            style: const TextStyle(
              fontSize: 14,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 20),
          _card([
            _freqOption(
              type: HouseTask.repeatNone,
              label: 'Não repetir',
            ),
            _divider(),
            _freqOption(
              type: HouseTask.repeatDaily,
              label: 'A cada',
              unit: _unitLabel('dia', 'dias'),
            ),
            _divider(),
            _freqOption(
              type: HouseTask.repeatWeekly,
              label: 'A cada',
              unit: _unitLabel('semana', 'semanas'),
              extra: _weekdayRow(),
            ),
            _divider(),
            _freqOption(
              type: HouseTask.repeatMonthly,
              label: 'A cada',
              unit: _unitLabel('mês', 'meses'),
              extra: _monthlyExtras(),
            ),
            _divider(),
            _freqOption(
              type: HouseTask.repeatYearly,
              label: 'A cada',
              unit: _unitLabel('ano', 'anos'),
              extra: _yearlyExtras(),
            ),
          ]),
          if (_config.repeats) ...[
            const SizedBox(height: 24),
            const Padding(
              padding: EdgeInsets.only(left: 4, bottom: 8),
              child: Text(
                'Duração',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
            _card([
              _durationOption(
                type: TaskRepeatConfig.durationForever,
                label: 'Sempre',
              ),
              _divider(),
              _durationOption(
                type: TaskRepeatConfig.durationTypeCount,
                label: 'Número específico de vezes',
                extra: _durationCountInput(),
              ),
              _divider(),
              _durationOption(
                type: TaskRepeatConfig.durationTypeUntil,
                label: 'Até',
                extra: _durationUntilButton(),
              ),
            ]),
          ],
        ],
      ),
    );
  }

  String _unitLabel(String singular, String plural) {
    return _config.interval == 1 ? singular : plural;
  }

  Widget _card(List<Widget> children) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(children: children),
    );
  }

  Widget _divider() => const Divider(height: 1, color: AppColors.border);

  Widget _freqOption({
    required String type,
    required String label,
    String? unit,
    Widget? extra,
  }) {
    final selected = _config.type == type;
    final showInterval = type != HouseTask.repeatNone;

    return InkWell(
      onTap: () => _selectType(type),
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _radio(selected),
                const SizedBox(width: 12),
                Expanded(
                  child: showInterval
                      ? Wrap(
                          crossAxisAlignment: WrapCrossAlignment.center,
                          spacing: 6,
                          children: [
                            Text(
                              label,
                              style: const TextStyle(
                                fontSize: 15,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            _intervalField(
                              enabled: selected,
                              onChanged: _setInterval,
                            ),
                            if (unit != null)
                              Text(
                                unit,
                                style: const TextStyle(
                                  fontSize: 15,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                          ],
                        )
                      : Text(
                          label,
                          style: const TextStyle(
                            fontSize: 15,
                            color: AppColors.textPrimary,
                          ),
                        ),
                ),
              ],
            ),
            if (selected && extra != null) ...[
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.only(left: 36),
                child: extra,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _durationOption({
    required String type,
    required String label,
    Widget? extra,
  }) {
    final selected = _config.durationType == type;
    return InkWell(
      onTap: () => _setDurationType(type),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _radio(selected),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    style: const TextStyle(
                      fontSize: 15,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
              ],
            ),
            if (selected && extra != null) ...[
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.only(left: 36),
                child: extra,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _radio(bool selected) {
    return Container(
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: selected ? AppColors.primary : AppColors.border,
          width: 2,
        ),
      ),
      child: selected
          ? Center(
              child: Container(
                width: 12,
                height: 12,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.primary,
                ),
              ),
            )
          : null,
    );
  }

  Widget _intervalField({
    required bool enabled,
    required ValueChanged<int> onChanged,
  }) {
    return SizedBox(
      width: 36,
      child: TextField(
        enabled: enabled,
        controller: _intervalController,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          color: enabled ? AppColors.primary : AppColors.textSecondary,
          decoration: TextDecoration.underline,
          decorationColor: enabled ? AppColors.primary : AppColors.border,
        ),
        decoration: const InputDecoration(
          isDense: true,
          contentPadding: EdgeInsets.zero,
          border: InputBorder.none,
        ),
        onChanged: (v) {
          final n = int.tryParse(v);
          if (n != null && n >= 1) onChanged(n);
        },
      ),
    );
  }

  /// D S T Q Q S S — domingo primeiro (weekday 7,1,2,3,4,5,6).
  Widget _weekdayRow() {
    const labels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    const weekdays = [7, 1, 2, 3, 4, 5, 6];
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: List.generate(7, (i) {
        final day = weekdays[i];
        final selected = _config.weekdays.contains(day);
        final isSunday = day == 7;
        return GestureDetector(
          onTap: () => _toggleWeekday(day),
          child: Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: selected ? AppColors.primary : Colors.transparent,
              border: Border.all(
                color: selected
                    ? AppColors.primary
                    : (isSunday ? AppColors.danger.withValues(alpha: 0.5) : AppColors.border),
              ),
            ),
            child: Text(
              labels[i],
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: selected
                    ? Colors.white
                    : (isSunday ? AppColors.danger : AppColors.textPrimary),
              ),
            ),
          ),
        );
      }),
    );
  }

  Widget _monthlyExtras() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _toggleChip(
          label: 'Selecionar datas para repetir',
          active: _showMonthDays,
          onTap: () => setState(() => _showMonthDays = !_showMonthDays),
        ),
        if (_showMonthDays) ...[
          const SizedBox(height: 12),
          _dayGrid(onToggle: _toggleMonthDay, selected: _config.monthDays),
        ],
      ],
    );
  }

  Widget _yearlyExtras() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _toggleChip(
          label: 'Selecionar meses para repetir',
          active: _showYearMonths,
          onTap: () => setState(() => _showYearMonths = !_showYearMonths),
        ),
        if (_showYearMonths) ...[
          const SizedBox(height: 12),
          _monthGrid(),
        ],
        const SizedBox(height: 12),
        _toggleChip(
          label: 'Selecionar dias para repetir',
          active: _showYearDays,
          onTap: () => setState(() => _showYearDays = !_showYearDays),
        ),
        if (_showYearDays) ...[
          const SizedBox(height: 12),
          _dayGrid(onToggle: _toggleMonthDay, selected: _config.monthDays),
        ],
      ],
    );
  }

  Widget _toggleChip({
    required String label,
    required bool active,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: active ? AppColors.primary : AppColors.border,
            width: active ? 1.5 : 1,
          ),
          color: active ? AppColors.primarySoft : AppColors.surfaceMuted,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: active ? AppColors.primary : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _dayGrid({
    required void Function(int) onToggle,
    required List<int> selected,
  }) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 7,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
        childAspectRatio: 1,
      ),
      itemCount: 31,
      itemBuilder: (_, i) {
        final day = i + 1;
        final isSelected = selected.contains(day);
        return GestureDetector(
          onTap: () => onToggle(day),
          child: Container(
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isSelected ? AppColors.primary : AppColors.surfaceMuted,
              border: Border.all(
                color: isSelected ? AppColors.primary : AppColors.border,
              ),
            ),
            child: Text(
              '$day',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isSelected ? Colors.white : AppColors.textPrimary,
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _monthGrid() {
    const labels = [
      'JAN.', 'FEV.', 'MAR.', 'ABR.',
      'MAI.', 'JUN.', 'JUL.', 'AGO.',
      'SET.', 'OUT.', 'NOV.', 'DEZ.',
    ];
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
        childAspectRatio: 1.6,
      ),
      itemCount: 12,
      itemBuilder: (_, i) {
        final month = i + 1;
        final isSelected = _config.yearMonths.contains(month);
        return GestureDetector(
          onTap: () => _toggleYearMonth(month),
          child: Container(
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isSelected ? AppColors.primary : AppColors.surfaceMuted,
              border: Border.all(
                color: isSelected ? AppColors.primary : AppColors.border,
              ),
            ),
            child: Text(
              labels[i],
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: isSelected ? Colors.white : AppColors.textPrimary,
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _durationCountInput() {
    return Row(
      children: [
        SizedBox(
          width: 56,
          child: TextField(
            controller: _durationCountController,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            textAlign: TextAlign.center,
            decoration: InputDecoration(
              isDense: true,
              filled: true,
              fillColor: AppColors.surfaceMuted,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: AppColors.border),
              ),
            ),
            onChanged: (v) {
              final n = int.tryParse(v);
              if (n != null && n >= 1) {
                _apply(_config.copyWith(durationCount: n));
              }
            },
          ),
        ),
        const SizedBox(width: 8),
        Text(
          _cycleUnitLabel(),
          style: const TextStyle(
            fontSize: 14,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }

  String _cycleUnitLabel() {
    final n = _config.durationCount ?? 10;
    switch (_config.type) {
      case HouseTask.repeatDaily:
        return n == 1 ? 'ciclo' : 'ciclos';
      case HouseTask.repeatWeekly:
        return n == 1 ? 'semana' : 'semanas';
      case HouseTask.repeatMonthly:
        return n == 1 ? 'mês' : 'meses';
      case HouseTask.repeatYearly:
        return n == 1 ? 'ano' : 'anos';
      default:
        return n == 1 ? 'vez' : 'vezes';
    }
  }

  Widget _durationUntilButton() {
    final date = _config.durationUntil ?? _anchor;
    final fmt = DateFormat('d/MM/y', 'pt_BR');
    return OutlinedButton(
      onPressed: _pickUntilDate,
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.primary,
        side: const BorderSide(color: AppColors.primary),
      ),
      child: Text(fmt.format(date)),
    );
  }
}
