# Hostinger Deploy

This project deploys through GitHub Actions using the same FTP model as the
previous portfolio repository.

Configure these secrets in the `production` environment of this repository:

- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- `FTP_SERVER_DIR`

`FTP_SERVER_DIR` should point to the Hostinger directory for the domain and must
end with `/`. Use the path visible to the FTP account, which may differ from the
absolute SSH path. Confirm it in hPanel before deploying. Keep
the production `.env` on the server and do not commit or upload it through the
workflow.

The workflow installs Composer and npm dependencies on GitHub Actions, builds
the frontend, uploads `vendor/`, uploads the Laravel app, and then uploads the
compiled public document root with an adjusted `index.php` for Hostinger.

## CI and deployment

- `ci.yml` runs on pushes to `main` and pull requests. It checks PHP, TypeScript,
  React tests, the production build, and dependency security audits.
- `deploy.yml` runs after a successful push CI on `main`. It checks out the exact
  tested commit and rejects commits that are no longer the head of `main`.
- Manual deployment is supported only on `main` and also requires its latest
  push CI to have succeeded. Re-running a failed CI is preferable to bypassing it.
- Both workflows build with Node 24. Hostinger does not need Node or npm.
- Missing FTP secrets fail before dependency installation, with the missing
  secret names in the log. Secret values are never printed by this check.

Configure secrets under **Settings > Environments > production > Environment
secrets**, or under repository **Settings > Secrets and variables > Actions**.
The failure `Input required and not supplied: server` means `FTP_SERVER` was
empty/unavailable to the job; it is not an npm compilation error.

## Existing server setup

This change preserves the existing FTP layout: the Laravel application and a
copy of its public files share the destination directory. Confirm the real
document root and its access rules before the first successful upload. Prefer
serving only Laravel's `public/` directory when the hosting setup allows it.

The workflow does not upload `.env`, `storage/`, `public/storage/`, or
`bootstrap/cache/`. They must already exist on the server with the appropriate
permissions and storage link. Back up production before the first deployment.
FTP does not run Artisan: migrations, cache rebuilding, and worker restarts
still require server-side execution (for example, SSH). Uploads are not atomic
and there is no automatic rollback. An SSH deployment can address those items
after the server paths and access are confirmed.

## Current Hostinger paths

The Laravel application is stored at
`/home/u306488098/domains/rechi.net.br/rechi-os`, while the domain document root
is `/home/u306488098/domains/rechi.net.br/public_html`. A manual SSH deployment
must copy the compiled contents of `rechi-os/public/build/` into
`public_html/build/`; updating only the application copy leaves Vite's public
manifest stale and new Inertia pages fail with HTTP 500.

The public storage link must point from `public_html/storage` to
`../rechi-os/storage/app/public`. Hostinger disables the PHP functions used by
`php artisan storage:link`, so create or verify this symlink directly over SSH.
After synchronizing a build, run `php artisan view:clear` from the application
directory and verify that every new Inertia entry is present in
`public_html/build/manifest.json`.
