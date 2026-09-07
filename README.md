# SSH Workspace Manager

**Secure browser-based SSH management with real interactive web terminals, SFTP file management, and diagnostics.**  
Built according to Software Requirements Specification (SRS v1.0).

---

## Architecture Overview

```
+--------------------------------------------------------------------------+
| Browser (React + TypeScript + xterm.js + Lucide Icons)                   |
|  - Dashboard: Server cards, Group/Tag filters, Health diagnostics         |
|  - Multi-tab Interactive Terminal: Real ANSI colors, resize, PTY stream  |
|  - SFTP File Manager: Directory tree, upload, download, delete, rename   |
|  - Server Modal: Add/Edit profile, Password/Key auth, Test connection   |
+--------------------+----------------------------------+------------------+
                     | HTTPS / REST                     | WSS (WebSocket)
                     v                                  v
+--------------------+----------------------------------+------------------+
| Spring Boot Backend (Java 21, Spring Security, JPA/Hibernate, SQLite)     |
|  - Security & Auth: JWT authentication, session isolation                |
|  - Credential Vault: AES-256-GCM encryption at rest with master key      |
|  - SshSessionManager: Apache MINA SSHD client, PTY allocation, Shell I/O |
|  - Service Tunnels: Local port forwarding trackers (MySQL, Redis, APIs)  |
|  - Database Console: Direct remote query execution & tabular viewer       |
|  - TerminalWebSocketHandler: Bidirectional JSON stream (/ws/terminal/{id})|
|  - SftpService: Directory listing, stream upload/download, safe paths   |
|  - MonitoringService: Read-only non-interactive SSH exec (top/df/uptime) |
|  - AuditService: Event recording with secret redaction                   |
+--------------------+-----------------------------------------------------+
                     | Embedded JDBC                    | SSH / SFTP
                     v                                  v
          SQLite (`sshworkspace.db`)           Remote SSH Targets
```

---

## Features

- **Zero-Config Embedded SQLite Database**: Stores all profiles, encrypted credentials, and tunnels in `sshworkspace.db` without requiring an external database server or Docker container.
- **Service Tunnels & Port Forwarding**: Forward isolated remote services (MySQL, PostgreSQL, Redis, MongoDB, Web apps, Docker) securely to `127.0.0.1` on your local machine over SSH.
- **Interactive Database & Service Console**: Execute queries directly on remote hosts (MySQL, PostgreSQL, Redis) with real-time latency tracking and tabular result grids.
- **Real Interactive Web Terminal**: Powered by `@xterm/xterm` with bidirectional WebSocket streaming, true PTY allocation (`xterm-256color`), and `TCP_NODELAY` for zero keystroke latency.
- **Multi-Tab Terminal Sessions**: Connect to multiple remote servers simultaneously and switch between live interactive tabs seamlessly.
- **SFTP Remote File Manager**: Browse directory hierarchy, view file permissions and sizes, upload files, download files, delete, rename, and create folders.
- **Server Health Diagnostics**: Monitor CPU load averages, RAM allocation, disk capacity, and system uptime using secure read-only commands over SSH.
- **Cyber-Ops Hacker Aesthetic**: Telemetry HUD bar, `Ctrl+K` Command Palette, scanlines overlay, and dark cyber grid UI.
- **Security & Credential Vault**:
  - Passwords and SSH private keys are encrypted at rest using **AES-256-GCM** with authenticated tags (SEC-001).
  - Private keys and passwords are never exposed in API responses or browser local storage (SEC-002).
  - Security audit logging with automatic secret redaction (SEC-007).
  - Strict user and session isolation (SEC-005).

---

## Quick Start Guide

### 1. Prerequisites
- Java 21 & Maven 3.8+
- Node.js 20+ & npm
- *(Optional)* Docker (only needed if running the local demo OpenSSH container)

### 2. Start All Services with One Command
```bash
./start.sh
```
*This starts:*
- The optional Test OpenSSH Server container on port `2222` (User: `demo`, Password: `demopassword123`)
- The Spring Boot backend with embedded SQLite on `http://localhost:8080`
- The React Cyber-Ops frontend on `http://localhost:5173`

To stop everything:
```bash
./stop.sh
```

---

## Default Test Credentials

- **Web Application Login**:
  - Email: `admin@example.com`
  - Password: `password123`
- **Pre-configured Test SSH Server**:
  - Host: `localhost`
  - Port: `2222`
  - Username: `demo`
  - Password: `demopassword123`

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register new user |
| `POST` | `/api/auth/login` | Authenticate & retrieve JWT |
| `POST` | `/api/auth/logout` | Terminate application session |
| `GET` | `/api/servers` | List user's server profiles |
| `POST` | `/api/servers` | Add server profile (credentials encrypted at rest) |
| `GET` | `/api/servers/{id}` | Get server profile |
| `PUT` | `/api/servers/{id}` | Update server profile |
| `DELETE` | `/api/servers/{id}` | Delete server profile & close active sessions |
| `POST` | `/api/servers/{id}/test` | Test SSH connectivity & measure latency |
| `POST` | `/api/servers/{id}/connect` | Create authenticated SSH session |
| `GET` | `/api/sessions` | List active sessions |
| `DELETE` | `/api/sessions/{id}` | Terminate SSH session |
| `GET` | `/api/servers/{id}/files` | SFTP browse remote directory |
| `POST` | `/api/servers/{id}/files/upload` | SFTP file upload |
| `GET` | `/api/servers/{id}/files/download` | SFTP file download |
| `DELETE` | `/api/servers/{id}/files` | SFTP file deletion |
| `POST` | `/api/servers/{id}/files/mkdir` | SFTP create directory |
| `PUT` | `/api/servers/{id}/files/rename` | SFTP rename file |
| `GET` | `/api/servers/{id}/monitoring` | Retrieve server health diagnostics |
| `GET` | `/api/servers/{id}/tunnels` | List port forwarding tunnels for server |
| `POST` | `/api/servers/{id}/tunnels` | Create new local port forwarding tunnel |
| `POST` | `/api/tunnels/{id}/start` | Start port forwarding tracker |
| `POST` | `/api/tunnels/{id}/stop` | Stop port forwarding tracker |
| `DELETE` | `/api/tunnels/{id}` | Delete port forwarding tunnel |
| `POST` | `/api/servers/{id}/database/query` | Execute SQL/Redis query over SSH |
| `WSS` | `/ws/terminal/{sessionId}` | Bidirectional WebSocket terminal stream |
