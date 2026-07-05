import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
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
      if (!mounted || error.code == GoogleSignInExceptionCode.canceled) {
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
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: const Color.fromARGB(255, 255, 255, 255),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            children: [
              const Spacer(flex: 2),
              Image.asset(
                'assets/images/logo_identidade.png',
                height: 240,
                fit: BoxFit.contain,
              ),
              const SizedBox(height: 24),
              Text(
                'Bem-vindo ao Casoiko',
                textAlign: TextAlign.center,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF2F3A2E),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'O cérebro do nosso lar.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyLarge?.copyWith(
                  color: const Color(0xFF5C6658),
                ),
              ),
              const Spacer(flex: 2),
              SizedBox(
                width: double.infinity,
                height: 54,
                child: FilledButton.icon(
                  onPressed: _isLoading ? null : _signInWithGoogle,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF3D5A4C),
                    foregroundColor: Colors.white,
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
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}
