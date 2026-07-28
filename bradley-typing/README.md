# Bradley Typing

Treino auditivo de digitação estilo Typing.com: o áudio toca sozinho e o aluno digita em tempo real. Os quadrados só revelam a letra depois que ele acerta a tecla.

## Requisitos

- Node.js 20+
- Windows (Electron)

## Rodar

```bash
cd bradley-typing
npm install
npm run dev
```

Isso sobe o Vite e abre a janela Electron.

## Adicionar áudios

1. Grave e corte cada fala (letra, sílaba, palavra ou frase) em `.mp3` ou `.wav`.
2. Coloque o arquivo na pasta correspondente:

```
public/audios/
├── letras/      ← a.mp3, b.mp3, …
├── silabas/     ← ba.mp3, be.mp3, …
├── palavras/    ← casa.mp3, …
└── frases/      ← frase-01.mp3, …
```

3. Cadastre o exercício em `src/data/exercises.json`:

```json
{
  "id": "letra-a",
  "type": "letra",
  "audio": "audios/letras/a.mp3",
  "answer": "a"
}
```

- `audio` é o caminho relativo a `public/`
- `answer` é a resposta **exata** (após trim de espaços nas pontas)
- Maiúsculas e minúsculas são diferenciadas no MVP

Os arquivos `.wav` atuais em `public/audios/` são **tons placeholder** só para testar a UI (`npm run placeholders`). Substitua pelos áudios reais quando estiverem prontos.

**Importante:** coloque os áudios em `public/audios/`, **não** em `dist/audios/`.  
Com `npm run dev`, o app lê de `public/`. A pasta `dist/` é gerada no build e pode ser sobrescrita.

## Alfabeto

Quando os áudios do alfabeto estiverem prontos:

1. Coloque `a.mp3` … `z.mp3` em `public/audios/letras/`
2. Copie as entradas de `src/data/exercises.alfabeto.exemplo.json` para `exercises.json` (ou substitua o arquivo)
3. Ajuste `audio` se usar `.wav` em vez de `.mp3`

Avise quando as pastas tiverem os arquivos — dá para validar se cada letra do JSON tem o áudio correspondente.

## Como funciona

### Menu
- Home estilo Typing.com: níveis Iniciante / Intermediário / Avançado
- Música ambiente: sorteia entre as faixas em `public/audios/` (`Loop de Pixel`, `Loop de Pixel 2`, `Pixelado Relax`, `Pixelado Relax (1)`). Ao acabar uma, troca para outra diferente. Volumes: menu ~18%; na lição ~6%; enquanto a letra fala ~1,5%

### Lição
1. O áudio do exercício toca automaticamente (100%)
2. A música de fundo **abaixa para 5%** enquanto o áudio do exercício toca e volta a 20% ao terminar
3. Digite no teclado — cada quadrado só mostra a letra depois que você acerta
4. **Espaço** repete o áudio (exceto quando o caractere esperado é um espaço)

## Currículo

Edite `src/data/curriculum.json` para adicionar níveis/lições. Os `exerciseIds` apontam para entradas em `src/data/exercises.json`.

A **Lição 1 (Iniciante)** é **J, F e Barra de Espaço**, com **11 telas** (segmentos na home). Compostos usam `audioSequence` — o app fala **uma tecla por vez** (a próxima só depois do acerto).

## Correção

Comparação **caractere a caractere**, case-sensitive (igual ao `answer` no JSON).

## Build

```bash
npm run build
```

Gera o renderer em `dist/` e o main process em `dist-electron/`.
