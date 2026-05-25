# Documentation HubGamers

Cette documentation est separee en deux lectures principales.

- [Guide developpeur](./developers.md): installation, architecture, conventions de code, base de donnees et design system.
- [Guide utilisateur](./users.md): parcours fonctionnels pour gerer organisations, equipes, tournois, inscriptions, matchs et brackets.

## Documents historiques

Certains fichiers a la racine restent utiles pour des sujets precis:

- `BULK_IMPORT_GUIDE.md`: import massif d'equipes depuis Excel/CSV.
- `PLACEMENT_BRACKET_EDITOR_GUIDE.md`: guide specialise du placement bracket.
- `AUTH_SETUP.md`: notes historiques d'authentification. A relire avec prudence avant reutilisation, car le produit a evolue.

## Regle de maintenance

Quand une feature change le parcours utilisateur, mettre a jour `docs/users.md`.
Quand une feature change l'architecture, les actions serveur, Prisma, les routes ou le design system, mettre a jour `docs/developers.md`.
