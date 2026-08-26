# Deployment

O provedor final ainda nao foi definido. O workflow `.github/workflows/deploy.yml` e `scripts/deploy.sh` sao placeholders seguros.

## Secrets esperados

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_PATH`
- Secrets reais do app no GitHub Environment `production`

## Fluxo esperado

1. CI passa na branch `main`.
2. Aprovacao manual no GitHub Environment.
3. Backup ou verificacao previa.
4. Dependencias de producao.
5. Build.
6. `php artisan migrate --force`.
7. Cache rebuild.
8. Restart de workers.
9. Health check em `/up`.
10. Rollback ou interrupcao segura em falha.

Nenhum deploy externo deve ser executado sem autorizaçao explicita.
