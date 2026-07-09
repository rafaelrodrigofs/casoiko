/// URL pública da API de mídia no VPS (com HTTPS).
///
/// Altere [kMediaApiBaseUrl] para o seu subdomínio antes do build, por exemplo:
/// `https://api.casoiko.com.br`
///
/// Também pode sobrescrever no build:
/// `flutter run --dart-define=MEDIA_API_BASE_URL=https://api.seudominio.com`
const kMediaApiBaseUrl = String.fromEnvironment(
  'MEDIA_API_BASE_URL',
  defaultValue: 'https://api.rafaelrodrigofs.cloud',
);
