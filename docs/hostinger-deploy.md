# Hostinger Deploy

This project deploys through GitHub Actions using the same FTP model as the
previous portfolio repository.

Configure these secrets in the `production` environment of this repository:

- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- `FTP_SERVER_DIR`

`FTP_SERVER_DIR` should point to the Hostinger directory for the domain. Keep
the production `.env` on the server and do not commit or upload it through the
workflow.

The workflow installs Composer and npm dependencies on GitHub Actions, builds
the frontend, uploads `vendor/`, uploads the Laravel app, and then uploads the
compiled public document root with an adjusted `index.php` for Hostinger.
