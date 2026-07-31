import 'package:flutter_test/flutter_test.dart';
import 'package:natipsico/theme/app_colors.dart';

void main() {
  test('primary wellness color', () {
    expect(AppColors.primary.toARGB32(), 0xFF5DB075);
  });
}
