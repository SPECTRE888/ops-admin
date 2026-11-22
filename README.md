# Ops HQ

App Mac personnelle qui regroupe les super admins des plateformes Ops Suite, un onglet par plateforme :

| Onglet | Adresse | Raccourci |
|---|---|---|
| Bar Ops Event | https://bar-ops-v2.vercel.app/admin.html | ⌘1 |
| Bar Ops Venue | https://bar-ops-venue.vercel.app/admin.html | ⌘2 |
| Helm Ops | à venir (pas encore de super admin) | ⌘3 |

- Chaque onglet a sa propre session (`persist:<id>`) : on se connecte une fois par plateforme, la connexion est gardée.
- L'app ne contient aucune donnée ni aucun secret : elle affiche les pages `admin.html` en ligne, protégées côté serveur par `SUPER_ADMIN_EMAILS`.
- Après la connexion Google, si la plateforme renvoie vers `app.html`, l'onglet revient tout seul au super admin.
- Liens externes (Stripe, Vercel, Supabase…) : ouverts dans le navigateur du Mac.
- Ajouter une plateforme : une ligne dans `PLATFORMS` (`shell/shell.js`) + son domaine dans `ALLOWED` (`main.js`).

## Construire et installer

```bash
npm install
npm run build                 # → dist/mac-arm64/Ops HQ.app (non signée, usage personnel)
cp -R "dist/mac-arm64/Ops HQ.app" /Applications/
```
