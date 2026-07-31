# NatiPsico

App Flutter de gestão de consultório (Natalia Farias).  
Design: FigmaShow `id_ef22ac7e`. Arquitetura: espelha o [casoiko](../casoiko).

## Stack

- Flutter 3.44+ / Dart 3.12
- Firebase Auth (Google Sign-In)
- Cloud Firestore (multi-tenant: `professionals/{uid}/...`)

## Setup Firebase (obrigatório antes de `flutter run`)

1. Crie o projeto **natipsico** no [Firebase Console](https://console.firebase.google.com).
2. Adicione app **Android** com package `com.rafael.natipsico`.
3. Ative **Authentication → Google**.
4. Crie banco **Firestore** (modo produção) e publique as regras de [`firestore.rules`](firestore.rules).
5. No terminal:

```bash
cd NatiPsico
dart pub global activate flutterfire_cli
flutterfire configure --project=natipsico
```

6. Copie o **Web client ID** (OAuth client_type 3 do `google-services.json`) para  
   [`lib/config/google_auth_config.dart`](lib/config/google_auth_config.dart) → `kGoogleWebClientId`.
7. Ajuste `kAllowedEmails` com o e-mail da Natalia.
8. Registre o SHA-1 do debug:

```bash
cd android
./gradlew signingReport
```

Cole o SHA-1 em Firebase → Project settings → Your apps → Android.

9. Baixe de novo o `google-services.json` para `android/app/`.

## Rodar

```bash
cd NatiPsico
flutter pub get
flutter run
```

## Estrutura

```
lib/
  config/          # Google client ID, whitelist
  models/          # Patient, Appointment, TherapySession, Payment
  screens/         # login, shell, dashboard, agenda, pacientes, sessao, financeiro
  services/        # Auth + CRUD Firestore
  theme/           # Paleta wellness (#5DB075)
  widgets/
```

## Telas

| Aba / rota | Função |
|------------|--------|
| Login | Google Sign-In |
| Início | Agenda do dia + métricas do mês |
| Agenda | Calendário + timeline + novo atendimento |
| Pacientes | Lista, filtros, perfil, CRUD |
| Sessão | Evolução, humor, plano (push) |
| Financeiro | Recebido/pendente + lançamentos |
