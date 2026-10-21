# EZTT (EasyTT)

Petite app de barre système pour **Windows et macOS** qui déclare automatiquement les jours de télétravail sur quarksUp.

Chaque jour ouvré, à une heure réglable (10h par défaut), EZTT regarde le Wi-Fi auquel le poste est connecté :

| Réseau | Action |
|---|---|
| Wi-Fi du bureau (réglable) | rien |
| N'importe quel autre Wi-Fi | demande de télétravail sur quarksUp + notification |
| Réseau non identifiable (Ethernet, hors ligne, SSID illisible) | aucune demande + notification |

> 🚧 **Projet en cours.** La lecture du Wi-Fi, la connexion SSO à quarksUp et la logique métier fonctionnent. La planification, les réglages et les notifications ne sont pas encore branchés : l'app n'envoie aucune demande pour l'instant.

## Fonctionnement

```
 ┌───────────── EZTT (Tauri) ──────────────┐
 │                                          │
 │  Rust                     TypeScript     │
 │  ├─ lecture du Wi-Fi ◄─── use case       │
 │  │   (par OS)             RunDailyCheck  │
 │  └─ fenêtre quarksUp ◄───┘               │
 │       │  eval_with_callback              │
 └───────┼──────────────────────────────────┘
         ▼
  <entreprise>.quarksup.net  (session SSO conservée)
   └─ script injecté : capture du Bearer token
                       + appels à api.quarksup.net depuis la page
```

### Connexion à quarksUp

La connexion se fait en SSO avec le compte pro, et l'API n'accepte que les appels faits depuis l'application web quarksUp. EZTT ouvre donc l'instance quarksUp de l'entreprise (`https://<entreprise>.quarksup.net`, saisie dans l'app) dans une fenêtre à lui :

1. **Première fois** : on saisit l'URL de l'instance et on se connecte normalement dans cette fenêtre. Les cookies SSO sont conservés dans le profil de la webview.
2. **Ensuite** : la page se reconnecte seule. Un script injecté au chargement (`src-tauri/src/quarksup_bridge.js`) récupère le Bearer token dans le trafic de la page (`fetch` et `XMLHttpRequest`) et fait les appels API depuis la page.
3. L'app lit les résultats via `eval_with_callback`. **La page quarksUp n'a accès à aucune commande de l'app** : seule la fenêtre principale a des permissions (`src-tauri/capabilities/default.json`).

Le token dure environ une heure : il sera rafraîchi en rechargeant la page avant chaque vérification.

### Lecture du Wi-Fi

| OS | Méthode | Pourquoi |
|---|---|---|
| Windows | nom du profil réseau (`Get-NetConnectionProfile`) de la carte Wi-Fi | depuis Windows 11 24H2, `netsh wlan` exige la localisation, souvent bloquée sur les postes gérés |
| macOS | `ipconfig getsummary` | depuis macOS 14.4, le SSID est masqué (`<redacted>`) sans autorisation de localisation (à traiter) |

## Architecture

Logique métier en TypeScript, organisée en hexagonal (ports & adapters). Rust ne sert qu'à accéder au système (Wi-Fi, fenêtres, appels dans la page).

```
src/
  domain/            règles métier pures, aucune dépendance
    daily-check-policy.ts   la vérification est-elle due ? où suis-je ?
    calendar-day.ts, check-time.ts, working-days.ts, office-network.ts
    network-status.ts       NetworkStatus / WorkLocation (unions discriminées)
  application/       orchestration
    run-daily-check.ts      use case : réseau → décision → demande → notification
    ports.ts                Clock, NetworkReader, RemoteWorkRequests, Notifier…
    daily-check-outcome.ts  résultat de la vérification + texte de la notification
  infrastructure/    adapters
    quarksup/               API quarksUp (via la fenêtre Tauri)
    tauri-network-reader.ts, system-clock.ts
  main.ts            UI temporaire de diagnostic
src-tauri/src/
  wifi.rs            lecture du SSID, une implémentation par OS
  quarksup.rs        fenêtre quarksUp + échanges avec la page
  quarksup_bridge.js script injecté dans la page quarksUp
tests/
  domain/            tests unitaires
  application/       use case avec fausses implémentations en mémoire
  infrastructure/    traduction des réponses quarksUp (réponses scriptées)
  architecture.test.ts  domain/ et application/ n'importent ni package ni couche externe
```

### Règles métier couvertes par les tests

- Wi-Fi du bureau → rien, sans notification.
- Autre Wi-Fi → demande de télétravail + notification.
- Réseau non identifié → aucune demande + notification.
- Pas de doublon : toute demande qui couvre le jour (même sur plusieurs jours, quel que soit son type) compte comme existante.
- PC éteint ou en veille à l'heure prévue → la vérification est rattrapée plus tard dans la journée.
- Rien les jours non travaillés.
- En cas d'échec → notification, sans nouvelle tentative le même jour.

## Développement

Prérequis : Node 22, yarn 1, Rust stable.

```zsh
yarn install
yarn test     # Vitest : domaine, application, adapters, architecture
yarn build    # type-check (app + tests) et build du front
```

### Itérer sur Windows depuis WSL

Tauri ne se lance pas sous WSL, mais l'exe Windows se compile depuis WSL avec `cargo-xwin` et WSL sait le lancer.

```zsh
sudo apt install -y clang lld llvm
ln -sf /usr/lib/llvm-18/bin/clang ~/.local/bin/clang-cl
cargo install --locked cargo-xwin

yarn dev                                                    # Vite sur localhost:1420
cd src-tauri && cargo xwin build --target x86_64-pc-windows-msvc
./target/x86_64-pc-windows-msvc/debug/eztt.exe
cargo xwin test --target x86_64-pc-windows-msvc            # tests Rust, exécutés côté Windows
```

En mode debug, l'app charge le front depuis Vite : les modifs TS/HTML s'affichent sans recompiler. Seules les modifs Rust demandent un `cargo xwin build`.

### Builds Windows et macOS

Le workflow GitHub Actions `build` (lancement manuel ou tag `v*`) lance les tests, puis produit :

- Windows : `.msi` et `-setup.exe`
- macOS : `.dmg` qui marche sur les Mac Intel comme Apple Silicon

```zsh
gh workflow run build
gh run download <run-id>
```

Les installeurs ne sont pas signés : les antivirus d'entreprise peuvent les bloquer le temps de les analyser, et sur macOS il faut lancer `xattr -dr com.apple.quarantine EZTT.app`.

## Feuille de route

- [x] App barre système Windows / macOS, un seul code, CI
- [x] Lecture du Wi-Fi sans localisation (Windows)
- [x] Connexion SSO à quarksUp et appels API depuis la page
- [x] Logique métier et use case testés
- [x] Adapter quarksUp (lecture des demandes, création de la demande)
- [ ] Vérifier une première fois sur un vrai jour que le `POST` crée bien une demande
- [ ] Écran de réglages (instance quarksUp, heure, jours, Wi-Fi du bureau)
- [ ] Planification, rafraîchissement du token, attente après la sortie de veille
- [ ] Notifications Windows / macOS, lancement au démarrage
- [ ] macOS : autorisation de localisation pour lire le SSID

## Remerciements

L'appel à l'API quarksUp reprend ce qu'avait trouvé l'extension Chrome d'un collègue : le token capturé dans la page, les appels faits depuis la page, `natureId` 75 pour le télétravail, et le workflow `TakeLeave`.
