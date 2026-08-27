# Hostinger Deploy

This project deploys through GitHub Actions over SSH.

Required repository secrets:

- `HOSTINGER_HOST`: SSH host from Hostinger.
- `HOSTINGER_PORT`: SSH port. Use `22` when empty.
- `HOSTINGER_USER`: SSH user.
- `HOSTINGER_SSH_KEY`: private SSH key authorized in Hostinger.
- `HOSTINGER_APP_PATH`: app directory outside the public web root.
- `HOSTINGER_PUBLIC_PATH`: domain web root, usually `public_html`.
- `HOSTINGER_PHP_BINARY`: optional PHP binary path. Use `php` when empty.
- `HOSTINGER_ENV`: full production `.env` contents.

`HOSTINGER_ENV` must include a valid `APP_KEY`, production `APP_URL`,
database settings and any optional OpenAI/mail settings used by the app.

The workflow installs Composer dependencies, builds assets, uploads a release,
links shared storage and `.env`, runs migrations, rebuilds Laravel caches and
copies the current `public` directory to the configured public path.
