# API

Base path: `/api/v1`

Todas as respostas seguem:

```json
{
  "data": {},
  "meta": {}
}
```

Endpoints publicos:

- `GET /api/v1/profile`
- `GET /api/v1/projects`
- `GET /api/v1/projects/{slug}`
- `GET /api/v1/experiences`
- `GET /api/v1/skills`
- `GET /api/v1/social-links`

Controles: rate limit `api-public`, cache Redis no repositorio publico e ETag por payload.

Endpoints administrativos futuros devem usar Sanctum com abilities especificas, autenticação e policies.
