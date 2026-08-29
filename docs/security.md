# Security

## Threat Model

Superficies principais: formulario de contato, login/admin, API publica, Ask Rechi, uploads futuros, Telescope e pipeline de deploy.

## Controls

- CSRF no web stack do Laravel.
- Rate limiting para API publica, contato e assistente.
- Headers CSP, HSTS em producao, `X-Content-Type-Options`, `Referrer-Policy` e `Permissions-Policy`.
- Registro publico desativado.
- Gate `managePortfolio` para admin e Telescope.
- Sanitizacao basica das respostas do assistente antes de persistir/renderizar.
- OpenAI somente pelo backend.
- Logs sem corpo integral das perguntas/mensagens sensiveis no Telescope.
- Cache invalidado por chave, sem `Cache::flush()`.
- CSP libera o servidor Vite em `127.0.0.1:5173` somente no ambiente local;
  producao continua restrita a assets da propria origem.

## Protected Data

Mensagens de contato, sessoes, conversas de IA, tokens Sanctum, dados de admin e configuracoes privadas.

## Residual Risks

CRUD administrativo completo ainda deve receber confirmacoes por operacao, validacao de upload final e auditoria detalhada por entidade. O deploy depende do provedor final.

## Dependency Updates

Rodar `composer audit`, `npm audit`, revisar releases de Laravel, Sanctum, Telescope e OpenAI PHP client, aplicar updates em branch, executar CI completo e fazer rollback se health check falhar.
