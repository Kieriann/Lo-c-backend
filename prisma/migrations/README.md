# Historique des migrations

La migration historique `20250901_drift_fix` doit rester strictement identique à la version déjà enregistrée en production, y compris son encodage inhabituel. Elle a été marquée comme appliquée dans PostgreSQL et sa modification provoquerait une divergence de checksum.

Pour une nouvelle base vide, utiliser une procédure de baseline Prisma avant `prisma migrate deploy`, car cette ancienne migration ne contient pas un script SQL exploitable.
