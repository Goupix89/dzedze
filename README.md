# 🧹 Cleaning Supervision Platform

Plateforme complète de supervision d'agents de nettoyage avec intégration GoPro, analyse IA et conformité RGPD.

## 🏗️ Architecture

```
cleaning-supervision/
├── backend/              # API Node.js + TypeScript
│   ├── src/
│   │   ├── controllers/  # Auth, Media, Stream, Mission
│   │   ├── services/     # Video, AI, Storage, Encryption
│   │   ├── middleware/   # JWT, Rate-limit, RGPD
│   │   └── routes/       # Routes API v1
│   └── Dockerfile
├── frontend/             # Dashboard React + TypeScript
│   └── src/
│       ├── pages/        # Dashboard, Missions, Media, Reports
│       └── components/   # UI components
├── mobile/               # App React Native (Expo)
│   └── src/
│       ├── screens/      # Capture, Missions, Notifications
│       └── services/     # GoPro, Upload, Socket
├── ai-service/           # Microservice Python FastAPI
│   └── main.py           # Analyse qualité + anomalies
├── infra/
│   ├── nginx/            # Reverse proxy + SSL
│   └── postgres/         # SQL init + migrations
├── docker-compose.yml
└── .env.example
```

## 🚀 Démarrage rapide

### Prérequis
- Docker + Docker Compose
- Node.js 20+ (dev local)
- Python 3.11+ (AI service local)

### 1. Configuration
```bash
cp .env.example .env
# Editez .env avec vos valeurs sécurisées
nano .env
```

### 2. Lancer avec Docker
```bash
docker-compose up -d
```

### 3. Vérifier les services
```bash
docker-compose ps
# Services: postgres, redis, minio, backend, ai-service, frontend, nginx
```

### 4. Accès
| Service       | URL                          |
|---------------|------------------------------|
| Dashboard     | http://localhost:5173        |
| API           | http://localhost:3000        |
| API Docs      | http://localhost:3000/api-docs|
| MinIO Console | http://localhost:9001        |
| AI Service    | http://localhost:8000/docs   |

**Compte admin par défaut:**
- Email: `admin@cleaningsupervision.com`
- Password: `Admin@123!` ← **Changez immédiatement**


Compte	Email	Mot de passe
Admin	admin@dzedze.app	Admin@123!
Manager	manager@dzedze.app	Manager@123!
Agent	agent@dzedze.app	Agent@123!

## 📱 Application Mobile

```bash
cd mobile
npm install
npx expo start
```

## 🔒 Sécurité & RGPD

### Données vidéo
- **Chiffrement AES-256-GCM** de tous les fichiers avant stockage
- **Durée de conservation** : 7 à 30 jours (configurable par mission)
- **Suppression automatique** via cron quotidien à 2h00
- **Journalisation complète** de tous les accès vidéo

### Consentement
- Consentement obligatoire au premier login (RGPD Art. 7)
- Pour le live streaming : acceptation explicite de l'agent
- Historique des consentements avec horodatage et IP

### Live Streaming
1. Manager demande un live → notification push à l'agent
2. L'agent **doit accepter** explicitement
3. Durée maximale configurable (5-30 minutes)
4. L'agent peut arrêter à tout moment
5. Audit log complet

## 🎥 Intégration GoPro

L'application mobile se connecte à la GoPro via :
1. **WiFi GoPro** : API Open GoPro (HTTP sur 10.5.5.9)
2. **Contrôle** : photos, vidéos, mode webcam
3. **Téléchargement** : fichiers via HTTP depuis la caméra
4. **Fallback** : caméra du smartphone si GoPro non disponible

### Modèles supportés
- GoPro Hero 9, 10, 11, 12 (Open GoPro API)
- GoPro Max (mode 360 non géré)

## 🤖 Analyse IA

L'IA analyse automatiquement chaque photo uploadée :
- **Score qualité global** (0-10)
- **Score propreté** : détection de taches, désordre
- **Anomalies** : localisation avec bounding box
- **Rapport avant/après** : comparaison automatique
- **Score agent** : historique sur 30 jours

## 🧪 Tests

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test

# AI Service
cd ai-service && python -m pytest
```

## 📊 Endpoints API clés

```
POST   /api/v1/auth/login           # Connexion
POST   /api/v1/auth/consent         # Donner consentement RGPD
GET    /api/v1/missions             # Liste missions
POST   /api/v1/missions             # Créer mission
GET    /api/v1/missions/:id         # Détail mission
POST   /api/v1/media                # Upload média
GET    /api/v1/media/:id            # Accéder à un média
DELETE /api/v1/media/:id            # Supprimer (RGPD)
POST   /api/v1/stream/request       # Demander live
PUT    /api/v1/stream/:id/respond   # Répondre (agent)
DELETE /api/v1/stream/:id           # Arrêter live
GET    /api/v1/audit                # Logs d'audit (admin)
```

## 🛡️ Variables d'environnement critiques

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Clé JWT (min 64 chars) - générer avec `openssl rand -hex 64` |
| `ENCRYPTION_KEY` | Clé chiffrement médias (32 bytes) |
| `POSTGRES_PASSWORD` | Mot de passe BDD fort |
| `REDIS_PASSWORD` | Mot de passe Redis |

## 📄 Licence

Propriétaire - Usage interne uniquement. Conformité RGPD requise.
DPO: dpo@yourcompany.com
