# Deployment

O deploy atual usa Hostinger via FTP. A configuracao e os limites do fluxo estao
em [hostinger-deploy.md](hostinger-deploy.md).

## Secrets esperados

- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- `FTP_SERVER_DIR` (com `/` no final)
- Configurados no GitHub Environment `production` ou nos secrets do repositorio.

## Fluxo atual

1. CI passa em um push na branch `main`.
2. Deploy verifica o SHA aprovado e a configuracao FTP.
3. Composer instala dependencias de producao e npm compila no GitHub Actions.
4. FTP envia dependencias, aplicacao e arquivos publicos compilados.

## Evolucao para deploy com SSH (ainda nao implementada)

1. CI passa na branch `main`.
2. Respeitar as regras de aprovacao configuradas no GitHub Environment.
3. Backup ou verificacao previa.
4. Dependencias de producao.
5. Build.
6. `php artisan migrate --force`.
7. Cache rebuild.
8. Restart de workers.
9. Health check em `/up`.
10. Rollback ou interrupcao segura em falha.

Nenhum deploy externo deve ser executado sem autorizaçao explicita.
