import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:natipsico/theme/app_colors.dart';
import 'package:natipsico/theme/app_system_ui.dart';

import '../../services/auth_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.authService});

  final AuthService authService;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _isLoading = false;

  Future<void> _signInWithGoogle() async {
    setState(() => _isLoading = true);
    try {
      await widget.authService.signInWithGoogle();
    } on GoogleSignInException catch (error) {
      if (!mounted) return;
      if (error.code == GoogleSignInExceptionCode.canceled) return;
      if (error.code == GoogleSignInExceptionCode.clientConfigurationError) {
        _showError(
          'Configure o Firebase (google-services.json + Web Client ID).',
        );
        return;
      }
      _showError('Não foi possível entrar com Google.');
    } on FirebaseAuthException catch (error) {
      if (!mounted) return;
      _showError(error.message ?? 'Erro de autenticação.');
    } catch (error) {
      if (!mounted) return;
      _showError('Algo deu errado. Verifique a conexão e o Firebase.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: AppSystemUi.lightSurface,
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: SafeArea(
          child: Stack(
            children: [
              Positioned(
                left: -40,
                top: -20,
                child: _blob(80, AppColors.primarySoft),
              ),
              Positioned(
                right: -30,
                top: 40,
                child: _blob(100, AppColors.primaryMute.withValues(alpha: 0.7)),
              ),
              Positioned(
                left: -40,
                bottom: 40,
                child: _blob(160, AppColors.primarySoft.withValues(alpha: 0.85)),
              ),
              Positioned(
                right: -50,
                bottom: 20,
                child: _blob(180, AppColors.primaryMute.withValues(alpha: 0.55)),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  children: [
                    const SizedBox(height: 72),
                    Container(
                      width: 56,
                      height: 56,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(28),
                      ),
                      child: const Text(
                        'NF',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 18,
                        ),
                      ),
                    ),
                    const SizedBox(height: 28),
                    const Text(
                      'Entrar',
                      style: TextStyle(
                        fontSize: 36,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Acesse com sua conta Google\npara continuar.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 15,
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                    ),
                    const Spacer(),
                    SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: FilledButton(
                        onPressed: _isLoading ? null : _signInWithGoogle,
                        child: _isLoading
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.5,
                                  color: Colors.white,
                                ),
                              )
                            : const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.g_mobiledata, size: 28),
                                  SizedBox(width: 4),
                                  Text('Entrar com o Google'),
                                ],
                              ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Usamos sua conta Google só para identificar você',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textMuted,
                      ),
                    ),
                    const Spacer(),
                    const Text(
                      'Ambiente seguro da profissional',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Ao entrar, você concorda com os termos de uso',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppColors.textMuted,
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _blob(double size, Color color) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(size / 2),
      ),
    );
  }
}
