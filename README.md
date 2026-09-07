# SSH Workspace Manager

**A futuristic, Cyber-Ops web-based SSH workspace, remote service manager, database console, and SFTP browser.**  
Connect to remote servers, cloud VPS instances, local machines, or Docker containers with zero keystroke latency, embedded zero-config SQLite storage, and deep automated service discovery.

---

## System Architecture

```
+----------------------------------------------------------------------------------------------------+
| Browser UI (React 18 + TypeScript + Vite + xterm.js + Lucide Icons + Cyber-Ops Design System)     |
|                                                                                                    |
|  - Dashboard: Server cards, Group/Tag filtering, live status indicators, "Connecting..." feedback  |
|  - Cluster Broadcast Shell: Multi-exec console, group/tag targeting, tiled matrix & table outputs  |
|  - Security Challenge Modal: Re-auth guardrails intercepting high-risk/destructive fleet commands  |
|  - Multi-Tab Terminals: Persistent PTY streams, scrollback retention, ANSI colors, fit-addon      |
|  - 0ms Instant Command Bar ("0ms EXEC //"): Zero-latency local line buffer with command history    |
|  - Service Manager Console: Automated SSH probe, category filters, daemon logs, lifecycle controls |
|  - CLI Command Inspector: Live command previews, preset templates, and on-the-fly argument editing |
|  - Service Tunnels: Local port forwarding manager & pre-populated bridges                         |
|  - Database Query Console: Direct remote SQL & Redis query executor with tabular data grids        |
|  - SFTP File Browser: Directory tree, upload/download, rename, mkdir, file deletion                |
|  - Telemetry HUD & Command Palette: System statistics bar, quick shortcuts via Ctrl+K, CRT effects |
+---------------------------------┬----------------------------------┬-------------------------------+
                                  | HTTPS / REST                     | WSS (WebSocket)
                                  v                                  v
+---------------------------------┴----------------------------------┴-------------------------------+
| Spring Boot Backend (Java 21, Spring Security, Spring Data JPA, SQLite, Apache MINA SSHD)          |
|                                                                                                    |
|  - Security & Authentication: Stateless JWT auth, user/session isolation                           |
|  - CommandSafetyService: Rule-based destructive command inspector (7 hazard categories)            |
|  - BroadcastService: Parallel remote execution engine with cryptographic password re-auth          |
|  - Credential Vault: AES-256-GCM encryption at rest with 256-bit master key                        |
|  - SshClientService: Apache MINA SSH Client with TCP_NODELAY and unverified server key handling    |
|  - ServiceManagerService: Composite non-destructive probe (ss/netstat, systemctl, OpenRC, docker)  |
|  - TerminalWebSocketHandler: Full-duplex JSON terminal I/O streaming (/ws/terminal/{sessionId})     |
|  - DatabaseService: Remote execution of queries across MySQL, MariaDB, PostgreSQL, and Redis       |
|  - TunnelService: Local port forwarding configuration and connection string generation             |
|  - SftpService: Streamed file transfer, path sanitization, and remote directory traversal          |
|  - MonitoringService: Controlled read-only system telemetry (/proc/meminfo, loadavg, uptime)       |
|  - AuditService: Comprehensive event audit logging with automatic secret redaction                 |
+---------------------------------┬----------------------------------┬-------------------------------+
                                  | Embedded JDBC                    | SSH Exec / PTY / SFTP Channels
                                  v                                  v
                 SQLite (`backend/sshworkspace.db`)         Remote SSH Targets / Cloud / Localhost
```

---

## Core Features

### 1. Remote & Local Service Manager
* **Automated Non-Destructive Probe**:
  Executes an SSH exec channel probe in $\approx 70\text{ms}$ inspecting:
  * **Listening Sockets**: `ss -tulpn` and `netstat -tulpn`
  * **Init Daemons**: `systemctl list-units` (Debian/Ubuntu/RHEL) and `rc-status` (Alpine OpenRC)
  * **Containers**: `docker ps -a`
  * **Process Table**: `ps -eo pid,comm,%cpu,%mem,etime`
* **Intelligent Heuristics & Correlation**: Automatically categorizes detected items into **Databases** (MySQL, PostgreSQL, Redis, MongoDB), **Web & APIs** (Nginx, Apache, Caddy, Node, Python), **Containers** (Docker), **System Daemons** (OpenSSH, Cron), and **Open Ports**.
* **Fresh Calculation & Zero Stale Data**: Every time the Service Manager modal opens or switches servers, existing telemetry and service lists are wiped clean immediately, showing live `SCANNING...` indicators and a radar sweep until fresh results are verified.
* **Live Daemon Logs**: Stream recent log output directly via `journalctl`, `docker logs`, or system log files with real-time search filtering and copy-to-clipboard.
* **Lifecycle Controls**: Confirmation-safe `Start`, `Stop`, `Restart`, and `Reload` triggers for services.
* **Workflow Bridges**:
  * **One-Click Port Forwarding**: Pre-fills the Tunnel Manager with the service's remote port in one click.
  * **One-Click Database Console**: Jumps directly into the SQL/Redis query console.
  * **One-Click Interactive CLI Shell**: Launches an interactive SSH terminal tab and immediately enters the service CLI (e.g. `redis-cli`, `mysql -u root -p`).

### 2. CLI Command Inspector & Editor
* **Command Visibility**: Displays the exact command that will execute right on the service card button (e.g. `>_ redis-cli` or `>_ mysql -u root -p`).
* **Inspect & Customize**: Clicking the **✏️ Edit** button opens the CLI Launch dialog allowing you to:
  * Inspect the command before running.
  * Modify flags, custom usernames, passwords, remote hosts, or OS-specific paths.
  * Click one of the contextual presets (e.g. `mariadb -u root -p`, `redis-cli -h 127.0.0.1 -p 6379`, `docker exec -it {name} bash`) to insert it immediately.
  * Save the modified command for the session or launch into an interactive terminal tab immediately.
* **Custom CLI for Any Service**: Add custom terminal commands on the fly for any detected background daemon or raw port.

### 3. 0ms Instant Command Bar (`0ms EXEC //`)
* **Eliminates Keystroke Lag**: Remote SSH sessions transmit keystrokes character-by-character across high-latency network connections. The 0ms Command Bar docks at the bottom of each terminal tab, allowing zero-latency local typing, native cursor movement, selection, and editing.
* **Batch Execution**: Press `Enter` or click `Run` to send the complete command line directly into the remote shell.
* **Command History**: Navigate previous commands executed in that session using `↑` (Arrow Up) and `↓` (Arrow Down).
* **Toggleable HUD**: Easily toggle the bar on or off at any time using the `0ms BAR: ON/OFF` badge.

### 4. Terminal History & Multi-Session Persistence
* **No Reconnection Drops**: Switching between the Dashboard and the Terminals view preserves 100% of open terminal tabs, scrollback history, and active processes without dropping WebSocket connections or unmounting the DOM.
* **Connecting Feedback**: The "Connect" button on server cards displays a live spinning radar indicator with `Connecting...` text and disables duplicate clicks while establishing the SSH handshake.
* **Smart Terminal Tabs**: Custom titles, server hostname labels, auto-fit geometry on viewport resize, and clean session termination on tab closure.

### 5. Service Tunnels & Port Forwarding
* **Secure Local Port Forwarding**: Forward isolated remote databases or internal APIs to `127.0.0.1` on your local machine over SSH.
* **Quick Presets**: Pre-configured templates for MySQL (`3306`), PostgreSQL (`5432`), Redis (`6379`), MongoDB (`27017`), Web Apps (`8080`), and Docker Daemon (`2375`).
* **Connection Strings**: Auto-generates copyable connection strings and CLI connection commands.

### 6. Interactive Database Query Console
* **Direct Remote Execution**: Query remote databases (MySQL, PostgreSQL, Redis) over SSH without opening local ports.
* **Tabular Results**: View formatted table results with column detection, row counts, execution time metrics, and raw output.

### 7. SFTP Remote File Manager
* **Full Hierarchy Browsing**: Browse directories, inspect file permissions, file sizes, and modification dates.
* **File Operations**: Streamed upload, download, file deletion, rename, and directory creation.

### 8. Embedded SQLite Database
* **Zero External Dependencies**: Stores all profiles, encrypted credentials, and tunnels in `backend/sshworkspace.db`. No PostgreSQL container or external database server required. Cold start in ~4 seconds.

### 9. Security & Credential Vault
* **AES-256-GCM Encryption**: Passwords and private keys are encrypted at rest using AES-256 in Galois/Counter Mode with 128-bit authentication tags.
* **Zero Exposure**: Credentials and private keys are never exposed in REST API responses or browser local storage.
* **Audit Logging**: Automatic event recording with secret and password redaction.

### 10. Cyber-Ops Design System
* **Modern Aesthetics**: Deep cyber-dark palette (`#080d14`), emerald/cyan/amber neon accents, subtle glassmorphism, glowing borders, CRT scanline toggle, real-time Telemetry HUD, and a quick keyboard command palette (`Ctrl+K`).

### 11. Multi-Exec / Cluster Broadcast Shell (DevOps Superpower)
* **Parallel Fleet Execution**: Dispatch shell commands simultaneously across multiple remote or local servers with non-blocking concurrency via `CompletableFuture` and SSH `ChannelExec`.
* **Scope & Target Filtering**: Filter target machines with quick chips by Server Group (`Dev`, `Aws`), Tags (`#tailscale`, `#production`), or individual toggle checkboxes.
* **DevOps Presets**: Built-in 1-click execution templates:
  - `uptime`: Load average & system uptime
  - `df -h /`: Root disk capacity & mount usage
  - `free -m`: Memory & swap breakdown
  - `docker ps`: Running containers and status
  - `uname -srm; cat /etc/os-release`: Kernel version and Linux distro
  - `who`: Active logged-in users and sessions
  - `ss -tulpn`: Open ports & listening daemon sockets
* **Split Grid & Consolidated Table Views**:
  - **Tiled Matrix View**: Visual cyber tiles per server showing real-time execution duration (e.g. `209ms`), exit status (`exit 0`), and full ANSI terminal outputs.
  - **Consolidated Table View**: Dense comparison table for auditing fleet-wide consistency.
* **1-Click Shell Jump (`Open Shell`)**: Click directly on any host tile to transition immediately into a dedicated, interactive PTY terminal session.
* **Report Export**: One-click download of complete multi-server execution runs in formatted Markdown (`.md`).

### 12. 3-Tier Destructive Command Safety & Password Re-Authentication
To prevent accidental cluster disasters or unauthorized tampering if your computer is accessed, commands pass through a 3-tier defense engine before execution:

* **Tier 1: Intelligent Pattern Inspector (Client & Server)**
  - Matches commands against **7 high-risk hazard categories**:
    1. `SYSTEM_POWER`: `reboot`, `shutdown`, `poweroff`, `halt`, `init 0/6`
    2. `FILE_DESTRUCTION`: `rm -rf`, `rmdir`, `shred`, `truncate`
    3. `SERVICE_DISRUPTION`: `systemctl stop/restart/disable`, `service stop`
    4. `CONTAINER_REMOVAL`: `docker rm`, `docker kill`, `docker system prune`, `compose down`
    5. `PROCESS_TERMINATION`: `kill -9`, `killall`, `pkill`
    6. `DISK_ALTERATION`: `mkfs`, `fdisk`, `parted`, `dd if=`
    7. `DATABASE_DROP`: `drop database`, `drop table`, `redis-cli flushall`
* **Tier 2: Interactive Security Challenge Modal (Frontend Guardrail)**
  - Immediately blocks outgoing requests—**no SSH connection is initiated**.
  - Displays a crimson hazard modal showing the detected category, exact command preview, and all affected target hosts.
  - Demands re-authentication with the user's **workspace account password** with animated shake error feedback on invalid input.
* **Tier 3: Cryptographic Backend Verification & Audit Trail (Backend Defense)**
  - Validates `confirmationPassword` against the user's BCrypt password hash in SQLite using Spring Security's `PasswordEncoder`.
  - **Rejection**: If unprovided or incorrect, throws `SecurityException` (`403 Forbidden`) and permanently logs `DESTRUCTIVE_EXEC_BLOCKED` or `DESTRUCTIVE_EXEC_AUTH_FAILED`. No SSH channel is ever opened.
  - **Authorization**: If valid, logs `DESTRUCTIVE_EXEC_AUTHORIZED` and safely dispatches the command across the fleet.

---

## Project Structure

```
Devkit/
├── backend/
│   ├── src/main/java/com/sshworkspace/
│   │   ├── config/              # Security, SQLite dialect, WebMvc, WebSocket config
│   │   ├── controller/          # REST Controllers (Auth, Server, Broadcast, Service, DB, SFTP, Tunnels)
│   │   ├── dto/                 # Request/Response Data Transfer Objects (BroadcastRequest, etc.)
│   │   ├── model/               # JPA Entities (User, ServerProfile, Tunnel, AuditLog)
│   │   ├── repository/          # Spring Data JPA Repositories
│   │   ├── security/            # JWT Token Provider, Filters, UserDetails
│   │   ├── service/             # SshClient, Broadcast, CommandSafety, ServiceManager, Database, Sftp
│   │   ├── websocket/           # TerminalWebSocketHandler (Full-duplex PTY streaming)
│   │   └── SshWorkspaceApplication.java
│   ├── src/main/resources/
│   │   ├── application.yml      # SQLite DB, JWT secret, logging config
│   │   └── db/migration/        # SQLite schema initialization
│   ├── pom.xml                  # Maven dependencies (Spring Boot 3, Apache MINA, SQLite)
│   └── sshworkspace.db          # Embedded database file (auto-created)
├── frontend/
│   ├── src/
│   │   ├── api/                 # Axios client, Auth, Server, Cluster Broadcast, Service, SFTP endpoints
│   │   ├── types/               # TypeScript interfaces (ServerProfile, Broadcast, Safety, etc.)
│   │   ├── utils/               # Command safety regex analyzer
│   │   ├── components/
│   │   │   ├── auth/            # AuthModal (Login & Registration)
│   │   │   ├── broadcast/       # BroadcastWorkspace (Multi-exec shell, server picker, tiled output)
│   │   │   ├── common/          # SecurityChallengeModal (Re-auth password challenge, hazard dialogs)
│   │   │   ├── dashboard/       # ServerCard ("Connecting...", Latency, Tags), ServerModal
│   │   │   ├── database/        # DatabaseConsoleModal (SQL & Redis query executor)
│   │   │   ├── layout/          # Navbar, CyberHUD, CommandPalette (Ctrl+K)
│   │   │   ├── monitoring/      # MonitoringModal (CPU, Memory, Uptime metrics)
│   │   │   ├── services/        # ServiceManagerModal (Probe, CLI Inspector/Editor, Logs)
│   │   │   ├── sftp/            # FileManagerModal (Directory tree, upload/download)
│   │   │   ├── terminal/        # TerminalWorkspace, TerminalView (xterm.js + 0ms Bar)
│   │   │   └── tunnels/         # TunnelManagerModal (Port forward bridge)
│   │   ├── App.tsx              # Root application router & persistent tab orchestrator
│   │   └── index.css            # Cyber-Ops design tokens, animations, CRT scanlines
│   ├── package.json             # React 18, Vite, Lucide Icons, xterm.js
├── start.sh                     # 1-Click start script for backend & frontend
└── stop.sh                      # Graceful shutdown script for all services
```

---

## Getting Started

### Prerequisites
* **Java 21** & **Maven 3.8+**
* **Node.js 20+** & **npm**

### 1-Click Startup

Clone the repository and run the script for your OS:

* **Linux & macOS**:
  ```bash
  chmod +x start.sh stop.sh
  ./start.sh
  ```
  *(To stop: `./stop.sh`)*

* **Windows (Command Prompt / Double-Click)**:
  ```cmd
  start.bat
  ```
  *(To stop: `stop.bat`)*

* **Windows (PowerShell)**:
  ```powershell
  .\start.ps1
  ```
  *(To stop: `.\stop.ps1`)*

This will automatically:
1. Detect prerequisites (Java 21+, Node 20+, Maven).
2. Clean up any stale processes on ports `8080` & `5173`.
3. Start the Spring Boot backend with embedded SQLite on `http://localhost:8080`.
4. Start the React Cyber-Ops frontend on `http://localhost:5173`.
5. Verify readiness and launch your browser.

### Manual Startup

**Backend**:
```bash
cd backend
mvn spring-boot:run
```
*Backend runs on `http://localhost:8080` with SQLite at `backend/sshworkspace.db`.*

**Frontend**:
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## Default Credentials

### Web Dashboard
* **URL**: [http://localhost:5173/](http://localhost:5173/)
* **Email**: `admin@example.com`
* **Password**: `password123`

---

## Connecting to Your Local Machine

You can use SSH Workspace to manage your local machine:

1. **Ensure OpenSSH Server is running on your machine**:
   ```bash
   # Ubuntu / Debian
   sudo apt update && sudo apt install -y openssh-server
   sudo systemctl enable --now ssh
   
   # Arch Linux
   sudo pacman -S openssh && sudo systemctl enable --now sshd
   
   # Fedora / RHEL
   sudo dnf install -y openssh-server && sudo systemctl enable --now sshd
   
   # macOS
   # System Settings -> General -> Sharing -> Enable 'Remote Login'
   ```
2. **Add the profile in SSH Workspace**:
   * Open [http://localhost:5173/](http://localhost:5173/) and click **`+ Add Server Profile`**.
   * **Profile Name**: `Localhost`
   * **Hostname**: `127.0.0.1` (or `localhost`)
   * **Port**: `22`
   * **Username**: Your Linux / macOS account username
   * **Authentication**: `PASSWORD` (your login password) or `KEY` (your private key)
3. Click **`Test Connection`** then **`Save Server Profile`**.
4. You can now use the **Services** module to inspect local daemons, launch terminals, and run commands with **0ms latency**.

---

## Cross-Platform Support

* **Host Machine (where Devkit runs)**:
  * **Linux, macOS, and Windows** are fully supported.
  * The backend is written in pure Java 21 using Apache MINA SSHD and standard JDBC with SQLite native shared libraries (including Windows x86/x64, macOS x86_64/ARM64 Apple Silicon, and Linux).
  * On Windows, run `./start.sh` via Git Bash / WSL, or run standard `mvn spring-boot:run` and `npm run dev`.
* **Target Machines (SSH hosts)**:
  * Interactive Terminal, SFTP Browser, and Port Forwarding work with **any SSH-capable operating system** (Linux, BSD, macOS, Windows OpenSSH).
  * The Service Manager and System Diagnostics modules are optimized for **Linux distributions and Docker environments** (Ubuntu, Debian, Alpine, CentOS, Fedora, Arch, Docker hosts).

---

## Configuration & Environment Variables

| Variable | Default Value | Description |
|---|---|---|
| `SERVER_PORT` | `8080` | Backend HTTP & WebSocket port |
| `SPRING_DATASOURCE_URL` | `jdbc:sqlite:sshworkspace.db` | SQLite JDBC connection string |
| `JWT_SECRET` | `S3cur3SShW0rksp4c3M4n4g3rJwTS3cr3tK3y2026!@#$` | Secret key used for signing JWT tokens |
| `JWT_EXPIRATION_MS` | `86400000` (24h) | JWT session validity duration in milliseconds |
| `APP_MASTER_KEY` | `SshWorkspaceMasterEncKey202632B!` | 32-byte AES key for encrypting credentials at rest |
| `SSH_CONNECT_TIMEOUT_MS` | `30000` (30s) | SSH connection and authentication timeout in milliseconds |
| `SSH_CHANNEL_TIMEOUT_MS` | `30000` (30s) | SSH PTY/Shell channel open verification timeout in milliseconds |
| `SSH_EXEC_TIMEOUT_MS` | `30000` (30s) | Timeout for remote diagnostic & service execution commands |
| `SSH_HEARTBEAT_INTERVAL_MS` | `15000` (15s) | Heartbeat keep-alive interval for cellular, VPN, and Tailscale links |

---

## REST & WebSocket API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register new user |
| `POST` | `/api/auth/login` | Authenticate & retrieve JWT |
| `POST` | `/api/auth/logout` | Invalidate session |

### Server Management
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/servers` | List server profiles |
| `POST` | `/api/servers` | Create server profile (credentials encrypted with AES-256-GCM) |
| `GET` | `/api/servers/{id}` | Get server profile details |
| `PUT` | `/api/servers/{id}` | Update server profile |
| `DELETE` | `/api/servers/{id}` | Delete server profile & close active sessions |
| `POST` | `/api/servers/{id}/test` | Test SSH connectivity and measure round-trip latency |
| `POST` | `/api/servers/{id}/connect` | Create authenticated SSH session |

### Service Manager
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/servers/{id}/services` | Discover running services, daemons, ports, and containers |
| `POST` | `/api/servers/{id}/services/action` | Execute lifecycle action (`START`, `STOP`, `RESTART`, `RELOAD`) |
| `GET` | `/api/servers/{id}/services/{name}/logs` | Stream recent logs from `journalctl`, `docker logs`, or system files |

### Interactive Terminal
| Protocol | Endpoint | Description |
|---|---|---|
| `WSS` | `/ws/terminal/{sessionId}` | Full-duplex JSON stream (`INPUT`, `OUTPUT`, `RESIZE`, `STATUS`) |

### Cluster Broadcast & Multi-Exec
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/cluster/broadcast` | Broadcast parallel shell command across targeted servers with safety verification & password re-authentication |

### Service Tunnels & Database Console
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/servers/{id}/tunnels` | List port forwarding tunnels |
| `POST` | `/api/servers/{id}/tunnels` | Create port forwarding tunnel |
| `POST` | `/api/tunnels/{id}/start` | Start tunnel tracker |
| `POST` | `/api/tunnels/{id}/stop` | Stop tunnel tracker |
| `DELETE` | `/api/tunnels/{id}` | Delete tunnel |
| `POST` | `/api/servers/{id}/database/query` | Execute SQL/Redis query over SSH channel |

### SFTP Remote Files
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/servers/{id}/files` | List remote files in directory |
| `POST` | `/api/servers/{id}/files/upload` | Upload file to remote path |
| `GET` | `/api/servers/{id}/files/download` | Download file from remote path |
| `DELETE` | `/api/servers/{id}/files` | Delete remote file |
| `POST` | `/api/servers/{id}/files/mkdir` | Create remote directory |
| `PUT` | `/api/servers/{id}/files/rename` | Rename remote file |

### Telemetry & Diagnostics
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/servers/{id}/monitoring` | Query CPU load, memory usage, disk, and uptime |
