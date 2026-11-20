---
name: efeitos-reels
description: Edicao de videos para Instagram/Reels da Amora Fashion e do Meu Bagageiro com efeitos modernos (glass widgets, orbits, spotlight, checklist, timeline, match-cut, apple-toggles, texto atras da pessoa, cards de UI estilo SaaS). Use sempre que o usuario mandar um video para editar, pedir um video novo "sem gravacao", pedir efeitos, cards, legendas ou citar /effects.
---

# Efeitos de Reels — Amora Fashion e Meu Bagageiro

## Preferencias do usuario (seguir sempre, sem perguntar de novo)
- Entregar o **arquivo final na conversa** (SendUserFile), nao so link. Fazer tudo de ponta a ponta, sem pedir confirmacao a cada passo.
- **Musica gerada por IA: NAO colocar** salvo pedido explicito (custa 5-14 creditos Higgsfield).
- **Efeitos sonoros: sempre colocar** (whoosh, pop, tick, shutter, printer, ding, coin, chime). Sao gerados localmente com ffmpeg, custo zero. Arquivos em `video-kit/public/sfx/`.
- **Narracao por IA**: pode usar quando fizer sentido; custa ~1 credito (ElevenLabs v4 Turbo, voz "Livia" `984ddbed-83d3-5388-84ce-02fe6c24befa`). Avisar o custo no resumo final.
- Gastos grandes (cenas animadas por IA, ~7,5 cred/cena Kling) => avisar antes com estimativa.
- Pedir arquivo **original em alta** (1080p/4K, enviado como Documento no WhatsApp) quando o video vier baixo.

## Marcas
### Amora Fashion (loja de moda feminina)
- Logos no Higgsfield (media_id): branco transparente `e25d06b3-ebdf-4003-a25f-031b6ecfc5c4`, preto transparente `3c7d212d-3be3-443f-ad0f-1076d775e16b`, fundo amarelo `7645c0cb-1da4-4375-9e3c-32995b2e6c3c` (URL: https://d2ol7oe51mr4n9.cloudfront.net/user_3HjyxIf1vSiKCjUTQovifsYiSxr/<id>.png).
- **Sempre usar a logo no lugar da palavra "Amora"** em titulos/assinaturas. Amarelo da marca ~ #FFBD4A.
- Estilo: editorial de moda (Farm/Animale/Shoulder): serifada (Playfair) + sans limpa, creme/nude/cafe, legenda em minusculas discreta, capitulos 01/02/03, etiqueta de preco, bolinhas de cor.

### Meu Bagageiro (SaaS para guias de excursao de compras / Bras)
- Repo `michel121246-hash/meu-bagageiro`; logo do onibus em `app/public/logo-icon-dark.png` (fundo escuro) e `logo-icon.png`.
- Cores: navy `#0D1B2A`/`#0B1626`, laranja `#FF6A00`. Fonte: Plus Jakarta Sans.
- Mensagens: "Sua excursao evoluiu", passageiros/poltronas/bagagens com QR + etiqueta Bluetooth/financeiro com lucro por viagem, "Teste gratis por 7 dias", "Sem cartao de credito".
- Video base pronto: composicao `MeuBagageiro` em `video-kit/src/Composition.tsx` (estilo Bling: fundo monocromatico, cards de vidro, carrossel 3D, chips).

## Ferramentas
### 1. Higgsfield `reel-effects` (efeitos prontos, render no sandbox)
Carregar com `get_workflow_instructions {workflow:"reel-effects"}`. Comandos uteis:
- `text-behind` (palavra gigante atras da cabeca; precisa matte = remove_background, pago),
- `katana-orbit` (miniaturas orbitando a cabeca; matte),
- `katana-app-window` (janela de app/Claude com prompt digitado),
- `katana-ig-follow` (card Seguir/Comentar no CTA; precisa @, numeros reais e palavra-chave),
- `glass-graph`, `over-the-shoulder` (antes/depois), `freeze-frame`, `tier-list`, `katana-file-scroll`,
- looks: `katana-bold`, `katana-cool-girl`, `katana-cool-dude` (spotlight com matte),
- `captions` (spotlight/cascade/classic), `grade-wipe`.
Ja trazem SFX licenciados, punch-in e grain. Unico passo pago: matte.

### 2. Remotion `video-kit/` (efeitos proprios, custo zero, render local)
- Projeto em `video-kit/` (Remotion 4.0.545). `npm i` se faltar node_modules.
- Render: `npx remotion render <Id> out/x.mp4 --browser-executable=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell --codec=h264 --crf=18`.
- Fontes locais em `public/fonts` (Plus Jakarta Sans, carregadas em Composition.tsx). Nao depender de Google Fonts.
- Biblioteca `src/Effects.tsx` (equivalentes dos comandos `/effects` do @eujorgefilho1):
  | Efeito | Componente | Uso |
  |---|---|---|
  | glass-widgets | `GlassWidgets` (stat com contador, bars, ring) | numeros/destaques ao redor da pessoa |
  | orbits | `Orbit` (images de `public/thumbs`) | "olha esses looks", portfolio |
  | spotlight | `Spotlight` (elipse; para recorte real use matte do Higgsfield) | frase de impacto |
  | todo | `Checklist` (items com `at` em frames) | caracteristicas sendo citadas |
  | timeline | `Timeline` (trilhas + agulha brilhando + %) | processo/andamento |
  | match-cut | `MatchCut` (paginas com a mesma palavra fixa) | palavra-chave: NOVIDADE, PROMOCAO |
  | apple-toggles | `AppleToggles` (toggles iOS acendendo) | beneficios on/off |
- Demo de referencia: composicao `EfeitosDemo` (`src/EfeitosDemo.tsx`) aplicada ao video da Amora.
- Fluxo com video gravado: transcrever (faster-whisper no sandbox Higgsfield) -> escolher momentos pelas palavras -> `<OffthreadVideo>` + efeitos em `<Sequence from=...>` -> SFX nos momentos -> render -> loudnorm `-14 LUFS` -> SendUserFile.

## Inspiracoes salvas (Higgsfield media_id)
- Bling "plano Elite" (UI motion SaaS, verde escuro, glass, carrossel): `6ee568d0-929c-4759-a550-de17ba238df2`.
- @eujorgefilho1 "7 edicoes no Claude Code" (/effects glass-widgets, orbits, spotlight, todo, timeline, match-cut, apple-toggles): `bfb5e429-218e-4681-a398-c108049efb18`.
- Animacao 3D estilo maquete (lojinha com bolinhas de olhos, etiquetas, personagem Pixar) — feito para Meu Bagageiro com Kling 3.0 std (~56 creditos/30s).

## Rede/ambiente
- Hosts liberados: upload.higgsfield.ai, d2ol7oe51mr4n9.cloudfront.net. Resultados de geracao vem de d8j0ntlcm91z4.cloudfront.net (bloqueado localmente): baixar no sandbox Higgsfield e re-subir via media_upload.
- Instagram/TikTok por link costuma falhar (login). Pedir o .mp4.
