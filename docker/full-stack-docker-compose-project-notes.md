# Docker Compose Full-Stack Project Notes

## Project

AI-powered Resume Analyzer

Stack:

- React frontend
- Node.js / Express backend
- PostgreSQL database
- Docker
- Docker Compose
- GitHub

---

## 1. Docker Image vs Container

### Image

An image is like a recipe or blueprint.

It is built from a Dockerfile.

Example:

```bash
docker build -t resume-backend .
```

This creates a Docker image, but the image itself is not running.

### Container

A container is a running instance of an image.

Example:

```bash
docker run resume-backend
```

Simple memory rule:

```text
Dockerfile = instructions
Image = built result
Container = running result
```

---

## 2. Dockerfile

A Dockerfile tells Docker how to build the image.

Important things to remember:

- `FROM` chooses the base image.
- `WORKDIR` chooses the folder inside the container.
- `COPY` moves files from the project into the image.
- `RUN` runs commands while building the image.
- `CMD` is the command that runs when the container starts.

---

## 3. Docker Compose

Docker Compose manages multiple containers together.

Before Compose, you would have to manually run:

- frontend container
- backend container
- postgres container
- networking
- ports
- volumes

With Compose, one command starts the whole system:

```bash
docker compose up --build
```

Docker Compose creates:

- containers
- a private Docker network
- volumes
- port mappings
- service dependencies

Mental model:

```text
Dockerfile = recipe for one image
Docker Compose = manager for the whole application
```

---

## 4. Container Networking

Inside Docker, each service gets its own name.

Example services:

```yaml
services:
  postgres:
  backend:
  frontend:
```

The backend connects to Postgres using the service name:

```env
DB_HOST=postgres
```

Not:

```env
DB_HOST=localhost
```

Important rule:

```text
Inside a container, localhost means that same container.
```

So if the backend uses `localhost`, it looks for Postgres inside the backend container, which is wrong.

Correct Docker database connection:

```text
backend container -> postgres:5432 -> postgres container
```

---

## 5. Ports

Example:

```yaml
ports:
  - "3001:3001"
```

Meaning:

```text
MacBook port 3001 -> container port 3001
```

Without port mapping, the app may be running inside Docker, but the browser cannot access it from the host machine.

Frontend:

```yaml
ports:
  - "3000:3000"
```

Backend:

```yaml
ports:
  - "3001:3001"
```

Postgres does not always need to expose `5432:5432` to the Mac. The backend can talk to it inside the Docker network using:

```text
postgres:5432
```

---

## 6. Volumes

Containers are temporary. Volumes are persistent storage.

Without a volume:

```text
Delete container = lose database data
```

With a volume:

```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
```

The database data survives even if the container is deleted.

Mental model:

```text
Container = employee
Volume = filing cabinet
```

The employee can leave. The filing cabinet stays.

---

## 7. init.sql

We used an SQL initialization file to create the database table automatically.

Compose mount:

```yaml
volumes:
  - ./Backend/init.sql:/docker-entrypoint-initdb.d/init.sql
```

Meaning:

```text
Take Backend/init.sql from the MacBook
Mount it inside the Postgres container
Postgres runs it when the database is first created
```

Example SQL:

```sql
CREATE TABLE IF NOT EXISTS resume_analysis (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  analysis_result TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Important:

Postgres only runs files in `/docker-entrypoint-initdb.d/` when the database volume is first created.

If the volume already exists, Postgres may say:

```text
Database directory appears to contain a database; skipping initialization
```

To test init.sql fresh:

```bash
docker compose down -v
```

Then:

```bash
docker compose up --build
```

Warning: `down -v` deletes the database volume.

---

## 8. Health Checks

Problem we hit:

```text
Backend starts before Postgres is ready
Backend tries to connect
Connection fails
```

Common error:

```text
ECONNREFUSED
```

Solution:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres -d resume_analyzer"]
  interval: 5s
  timeout: 5s
  retries: 5
```

Then backend waits for Postgres:

```yaml
depends_on:
  postgres:
    condition: service_healthy
```

Meaning:

```text
Do not start backend until Postgres is actually ready.
```

---

## 9. Environment Variables and .env

A `.env` file stores configuration and secrets.

Example:

```env
DB_USER=postgres
DB_HOST=postgres
DB_NAME=resume_analyzer
DB_PASS=password
DB_PORT=5432
OPENAI_API_KEY=your_key_here
```

Important:

```text
.env is not logs.
.env is configuration.
```

Never commit `.env` to GitHub.

Use `.gitignore` to protect it:

```text
.env
Backend/.env
frontend/.env
```

---

## 10. .dockerignore

`.dockerignore` tells Docker what not to send into the build context.

Important examples:

```text
node_modules
frontend/node_modules
Backend/node_modules
.git
.env
Backend/.env
frontend/.env
uploads
Backend/uploads
.DS_Store
```

Why this matters:

- faster builds
- smaller build context
- avoids copying secrets
- avoids copying unnecessary files

---

## 11. Git Workflow

### Working Directory

Files on the computer.

### Staging Area

Files selected for the next commit.

```bash
git add .
```

Means:

```text
Put these changes into the staging area.
```

### Commit

```bash
git commit -m "Dockerize full-stack resume analyzer application"
```

Means:

```text
Create a snapshot on my computer.
```

### Push

```bash
git push origin main
```

Means:

```text
Upload my local commits to GitHub.
```

Mental model:

```text
git add = select changes
git commit = save snapshot locally
git push = upload snapshot to GitHub
```

---

## 12. Git Pull/Rebase Issue

Push was rejected because GitHub had commits that the MacBook did not have.

Error:

```text
! [rejected] main -> main (fetch first)
```

Meaning:

```text
GitHub has work that my local repo does not have yet.
```

Solution used:

```bash
git pull origin main --rebase
```

Then:

```bash
git push origin main
```

Meaning:

```text
Get GitHub changes first, replay my local commit on top, then push.
```

---

## 13. Common Errors We Debugged

### Port already allocated

Example:

```text
3001 already in use
5432 already in use
```

Meaning:

Another process or container is already using that port.

Useful commands:

```bash
docker ps
docker stop <container_name_or_id>
```

### ENOTFOUND postgres

Meaning:

Docker could not resolve the hostname `postgres`.

Usually caused by:

- backend not running in the same Docker Compose network
- wrong service name
- running backend with plain `docker run` instead of Compose

### Password authentication failed

Meaning:

Backend password and Postgres password do not match.

Check:

- `POSTGRES_PASSWORD` in Compose
- `DB_PASS` in `.env`
- old Docker volume still using old credentials

If testing from scratch:

```bash
docker compose down -v
```

Then rebuild.

### Relation does not exist

Meaning:

The table does not exist in PostgreSQL.

Solution:

- create the table manually, or
- add it to `init.sql`, then recreate the volume.

### MODULE_NOT_FOUND

Meaning:

Node tried to run a file that did not exist in the current working directory.

This happened because Docker was standing in the wrong folder.

Fix:

Use the correct `WORKDIR` or correct `CMD` path.

---

## 14. Final Architecture

```text
Browser
  -> React frontend container on port 3000
  -> Node/Express backend container on port 3001
  -> PostgreSQL container on port 5432 inside Docker network
  -> Docker volume for persistent database storage
```

Simple version:

```text
Frontend -> Backend -> Postgres -> Volume
```

---

## 15. Interview Explanation

If asked what I did, say:

```text
I Dockerized a full-stack AI Resume Analyzer application consisting of a React frontend, Node.js backend, and PostgreSQL database. I used Docker Compose to orchestrate multiple containers, configured networking, volumes, environment variables, health checks, and automatic database initialization with SQL scripts. I debugged container networking, database authentication, startup timing, and port conflicts, then committed and pushed the project to GitHub.
```

---

## 16. Resume Bullet

```text
Dockerized and deployed a full-stack AI Resume Analyzer using React, Node.js, PostgreSQL, and Docker Compose; configured container networking, persistent PostgreSQL volumes, environment variables, health checks, and automated database initialization.
```

---

## 17. Key Commands

Start full app:

```bash
docker compose up --build
```

Start in background:

```bash
docker compose up -d --build
```

Stop containers:

```bash
docker compose down
```

Stop and delete volumes:

```bash
docker compose down -v
```

Show running containers:

```bash
docker ps
```

Backend logs:

```bash
docker logs resume-backend
```

Postgres logs:

```bash
docker logs resume-postgres
```

Enter Postgres:

```bash
docker exec -it resume-postgres psql -U postgres -d resume_analyzer
```

List tables in Postgres:

```sql
\dt
```

Check Git status:

```bash
git status
```

Commit:

```bash
git commit -m "Dockerize full-stack resume analyzer application"
```

Push:

```bash
git push origin main
```

---

## 18. What To Remember Most

Do not memorize only commands.

Remember the system:

```text
Dockerfile builds images.
Images create containers.
Compose runs multiple containers together.
Docker network lets containers talk by service name.
Ports expose containers to the host machine.
Volumes preserve data.
.env stores configuration.
Health checks control startup timing.
Git commits save snapshots.
Git push sends snapshots to GitHub.
```
