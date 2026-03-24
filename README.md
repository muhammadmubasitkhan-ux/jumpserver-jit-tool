# JumpServer JIT Access Portal

A self-service **Just-In-Time (JIT) privileged access** tool that integrates with
[JumpServer](https://www.jumpserver.com/) via its REST API. Users request
time-limited access, approvers review, and the tool automatically creates and
cleans up JumpServer permissions — ensuring **zero standing privileges**.

## How It Works

```
User logs in at /auth/login (JumpServer credentials)
        │
        ├── System Admin ──> /approvals + /dashboard
        │
        └── Requester ─────> /request submit access request
                               │
                               ▼
                     Approver approves request
                               │
                               ▼
                 JumpServer permission is created with expiry
                               │
                               ▼
             Manual revoke or background cleanup removes permission
```

## Features

- **Single login page** using JumpServer credentials (`/auth/login`)
- **Automatic role detection** — system admins go to approvals/dashboard, users go to request portal
- **Session-based access control** for requester and admin routes
- **Web portal** for requesting and approving access
- **REST API** for integration with Slack, Teams, ServiceNow, etc.
- **Time-limited permissions** — auto-expire after the approved window
- **Background cleanup** — removes stale JumpServer permissions automatically
- **Dashboard** — real-time view of active grants, pending requests, stats
- **Email notifications** — optional alerts on request/approve/deny
- **Audit trail** — every request, approval, denial, and revocation is logged

## Quick Start

### 1. Clone and install

```bash
cd C:\Users\mkhan2\Documents\jumpserver-jit-tool
pip install -r requirements.txt
```

### 2. Configure

```bash
copy .env.example .env
# Edit .env with your JumpServer URL and API token
```

To get a JumpServer Private Token:
```bash
docker exec -it jms_core /bin/bash
cd /opt/jumpserver/apps
python manage.py shell
>>> from users.models import User
>>> u = User.objects.get(username='admin')
>>> u.create_private_token()
```

### 3. Run

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Open http://localhost:8000/auth/login to sign in.

## Frontend UI (React)

The full Lovable-generated UI is integrated under `frontend/`.

Run it in a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: http://localhost:8080

Notes:
- Vite proxy is configured so `/auth`, `/request`, `/approvals`, and `/dashboard`
  are forwarded to `http://localhost:8000`
- Keep backend running on port `8000` while using the React UI

## Docker

### Run with Docker Compose

```bash
copy .env.example .env
docker compose up --build -d
```

Frontend UI URL: http://localhost:8080

Notes:
- SQLite data persists in host path `./data` (file: `./data/jit_access.db`)
- Container forces `JIT_DATABASE_URL=sqlite:///./data/jit_access.db`
- Frontend container proxies `/auth`, `/request`, `/approvals`, `/dashboard` to backend
- Backend service is internal-only in Docker (not exposed to host by default)

Important:
- Do not run `docker compose down -v` if you want to keep existing data.
- Rebuild/restart is safe: `docker compose up --build -d`

## Operations

- Liveness probe: `GET /api/healthz`
- Readiness probe: `GET /api/readyz`
- Every response includes `X-Request-ID` for traceability
- Admin approvals page includes audit filters and CSV export

### Backup and Restore

```bash
python scripts/backup_db.py
python scripts/restore_db.py --backup backups/jit_access-YYYYMMDD-HHMMSS.db
```

### Stop

```bash
docker compose down
```

### Rebuild after code changes

```bash
docker compose up --build -d
```

## Pages

| URL                  | Description                         |
| -------------------- | ----------------------------------- |
| `/auth/login`        | Login with JumpServer credentials   |
| `/request`           | Submit a new JIT access request     |
| `/request/my`        | View your own request history       |
| `/approvals`         | Review pending / manage active      |
| `/dashboard`         | Stats, active grants, cleanup       |

## API Endpoints

| Method | Endpoint                                          | Description                          |
| ------ | ------------------------------------------------- | ------------------------------------ |
| GET    | `/request/api/jumpserver/assets`                  | Search/list JumpServer assets        |
| GET    | `/request/api/jumpserver/accounts/{asset_id}`     | List accounts for an asset           |
| POST   | `/request/api/requests`                           | Submit a request (JSON)              |
| GET    | `/request/api/requests`                           | List requests                        |
| GET    | `/request/api/requests/{id}`                      | Get a single request                 |
| POST   | `/approvals/api/requests/{id}/approve`            | Approve a request (admin)            |
| POST   | `/approvals/api/requests/{id}/deny`               | Deny a request (admin)               |
| POST   | `/approvals/api/requests/{id}/revoke`             | Revoke active access (admin)         |
| GET    | `/dashboard/api/stats`                            | Dashboard stats (admin)              |
| GET    | `/dashboard/api/active-grants`                    | Currently active grants (admin)      |
| GET    | `/dashboard/api/health`                           | JumpServer + app health (admin)      |
| GET    | `/dashboard/api/test-auth`                        | Raw JumpServer endpoint auth checks  |

### Example: Request access via API

```bash
curl -X POST http://localhost:8000/request/api/requests \
  -H "Content-Type: application/json" \
  -d '{
    "requester": "Muhammad Khan",
    "requester_email": "mkhan@example.com",
    "jumpserver_user": "mkhan2",
    "asset_hostname": "oracle-prod-01",
    "accounts": "dba",
    "reason": "Monthly patching requires DBA access",
    "duration_minutes": 120
  }'
```

### Example: Approve via API

```bash
curl -X POST http://localhost:8000/approvals/api/requests/{request_id}/approve \
  -H "Content-Type: application/json" \
  -d '{"reviewer": "Admin", "comment": "Approved for patching window"}'
```

## Project Structure

```
jumpserver-jit-tool/
├── app/
│   ├── auth.py                 # Session helpers + role checks
│   ├── main.py                 # FastAPI app + background cleanup
│   ├── config.py               # Settings from .env
│   ├── database.py             # SQLite for request tracking
│   ├── dependencies.py         # Shared client dependencies
│   ├── jumpserver_client.py    # JumpServer REST API client
│   ├── models.py               # Pydantic request/response models
│   ├── routes/
│   │   ├── auth.py             # Login/logout routes
│   │   ├── requests.py         # Requester pages + request APIs
│   │   ├── approvals.py        # Admin approvals + action APIs
│   │   └── admin.py            # Admin dashboard + health/cleanup APIs
│   ├── services/
│   │   ├── jit_service.py      # Core JIT orchestration logic
│   │   └── notification.py     # Email notifications
│   ├── templates/              # Jinja2 HTML templates
│   │   ├── base.html
│   │   ├── request_access.html
│   │   ├── approvals.html
│   │   ├── dashboard.html
│   │   └── my_requests.html
│   └── static/
│       └── style.css
├── .env.example
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── frontend/
├── requirements.txt
└── README.md
```

## What JumpServer API Calls Are Made

| When                | API Call                                    |
| ------------------- | ------------------------------------------- |
| Request submitted   | `GET /api/v1/users/users/` (validate user)  |
|                     | `GET /api/v2/assets/assets/` (validate asset) |
| Request approved    | `POST /api/v1/perms/asset-permissions/`     |
| Access revoked      | `PATCH .../asset-permissions/{id}/`         |
|                     | `DELETE .../asset-permissions/{id}/`        |
| Periodic cleanup    | `DELETE .../asset-permissions/{id}/`        |
