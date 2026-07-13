import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:casoiko/theme/app_colors.dart';

import 'package:google_sign_in/google_sign_in.dart';

import '../services/auth_service.dart';

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
      debugPrint('GoogleSignInException: ${error.code} - $error');
      if (!mounted) return;
      if (error.code == GoogleSignInExceptionCode.canceled) {
        if (error.toString().contains('reauth failed')) {
          _showError(
            'Falha no login Google. Cadastre o SHA-1 deste computador no Firebase e baixe o google-services.json de novo.',
          );
        }
        return;
      }
      if (error.code == GoogleSignInExceptionCode.clientConfigurationError) {
        _showError(
          'Configuração do Google incompleta. Ative o login Google no Firebase e baixe o google-services.json de novo.',
        );
        return;
      }
      _showError('Não foi possível entrar com Google (${error.code.name}).');
    } on FirebaseAuthException catch (error) {
      debugPrint('FirebaseAuthException: ${error.code} - ${error.message}');
      if (!mounted) return;
      _showError(error.message ?? 'Erro de autenticação.');
    } catch (error) {
      debugPrint('Sign in error: $error');
      if (!mounted) return;
      _showError('Algo deu errado. Verifique sua conexão e tente de novo.');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          behavior: SnackBarBehavior.floating,
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: Colors.white,
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Image.asset(
              'assets/images/banner_login.png',
              width: double.infinity,
              fit: BoxFit.fitWidth,
              alignment: Alignment.topCenter,
            ),
            Expanded(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 36),
                  child: Image.asset(
                    'assets/images/nova_logo_identidade.png',
                    width: 500,
                    fit: BoxFit.contain,
                  ),
                ),
              ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(28, 0, 28, 32),
                child: SizedBox(
                  width: double.infinity,
                  height: 54,
                  child: FilledButton.icon(
                    onPressed: _isLoading ? null : _signInWithGoogle,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor:
                          AppColors.primary.withValues(alpha: 0.6),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(27),
                      ),
                    ),
                    icon: _isLoading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Image.network(
                            'https://developers.google.com/identity/images/g-logo.png',
                            height: 20,
                            width: 20,
                            errorBuilder: (context, error, stackTrace) =>
                                const Icon(Icons.login, size: 20),
                          ),
                    label: Text(
                      _isLoading ? 'Entrando...' : 'Continuar com Google',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
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
