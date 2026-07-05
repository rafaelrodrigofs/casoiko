import 'package:flutter/material.dart';

class ContasScreen extends StatelessWidget {
  const ContasScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0E8),
      appBar: AppBar(
        backgroundColor: const Color(0xFF3D5A4C),
        foregroundColor: Colors.white,
        title: const Text('Contas'),
      ),
      body: const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.receipt_long_outlined,
                size: 64,
                color: Color(0xFF3D5A4C),
              ),
              SizedBox(height: 16),
              Text(
                'Contas da casa em breve',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF2F3A2E),
                ),
              ),
              SizedBox(height: 8),
              Text(
                'Luz, internet, aluguel — quem pagou e quanto cada um deve.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Color(0xFF5C6658),
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
