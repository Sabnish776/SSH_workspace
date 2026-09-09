export interface User {
  id: number;
  name: string;
  email: string;
}

export interface ServerStatusInfo {
  status: 'ONLINE' | 'OFFLINE' | 'CHECKING';
  latencyMs?: number;
  message?: string;
  lastChecked?: number;
}

export interface ServerProfile {
  id: number;
  name: string;
  hostname: string;
  port: number;
  username: string;
  authType: 'PASSWORD' | 'KEY';
  groupName?: string;
  tags: string[];
  status?: 'ONLINE' | 'OFFLINE' | 'CHECKING' | 'CONNECTING' | 'ERROR';
  latencyMs?: number;
  statusMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServerCreateInput {
  name: string;
  hostname: string;
  port: number;
  username: string;
  authType: 'PASSWORD' | 'KEY';
  password?: string;
  privateKey?: string;
  passphrase?: string;
  groupName?: string;
  tags: string[];
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

export interface ConnectResult {
  sessionId: string;
  serverId: number;
  serverName: string;
  wsUrl: string;
  status: string;
}

export interface TerminalTabItem {
  id: string; // session ID
  serverId: number;
  serverName: string;
  serverHostname: string;
  status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  initialCommand?: string;
}

export interface SftpFileItem {
  name: string;
  path: string;
  directory: boolean;
  size: number;
  modifiedTime: number;
  permissions: string;
}

export interface ServerMetrics {
  cpuUsage: string;
  memoryUsage: string;
  memoryDetails: string;
  diskUsage: string;
  diskDetails: string;
  loadAverage: string;
  uptime: string;
  osName: string;
}

export interface ServiceTunnel {
  id: number;
  serverId: number;
  serverName?: string;
  name: string;
  serviceType: 'MYSQL' | 'POSTGRES' | 'REDIS' | 'MONGODB' | 'HTTP' | 'CUSTOM';
  localPort: number;
  remoteHost: string;
  remotePort: number;
  active: boolean;
  connectionString: string;
  cliCommand: string;
  createdAt?: string;
}

export interface TunnelCreateInput {
  name: string;
  serviceType: string;
  localPort: number;
  remoteHost?: string;
  remotePort: number;
  autoStart?: boolean;
}

export interface DatabaseQueryInput {
  serviceType: 'MYSQL' | 'POSTGRES' | 'REDIS';
  query: string;
  databaseName?: string;
  username?: string;
  password?: string;
  port?: number;
}

export interface DatabaseQueryResult {
  success: boolean;
  columns: string[];
  rows: string[][];
  rowCount: number;
  executionTimeMs: number;
  rawOutput?: string;
  error?: string;
}

export interface DiscoveredService {
  id: string;
  name: string;
  displayName: string;
  category: 'DATABASE' | 'WEB' | 'RUNTIME' | 'CONTAINER' | 'SYSTEM' | 'CUSTOM';
  status: 'RUNNING' | 'STOPPED' | 'FAILED' | 'UNKNOWN';
  source: 'SYSTEMD' | 'OPENRC' | 'DOCKER' | 'SOCKET' | 'PROCESS' | 'BREW' | 'LAUNCHD' | 'WINDOWS_SERVICE';
  pid?: number;
  ports: number[];
  bindAddresses: string[];
  cpuPercent?: string;
  memoryUsage?: string;
  uptime?: string;
  cliCommand?: string;
  defaultTunnelPort?: number;
  canManage: boolean;
}

export interface ServiceActionInput {
  serviceId: string;
  serviceName: string;
  action: 'START' | 'STOP' | 'RESTART' | 'RELOAD';
  source?: string;
}

export interface ServiceActionOutput {
  success: boolean;
  message: string;
  output?: string;
}

export interface ServiceLogsResult {
  serviceName: string;
  source: string;
  lines: string[];
  error?: string;
}

export interface BroadcastRequest {
  serverIds: number[];
  command: string;
  timeoutMs?: number;
  confirmationPassword?: string;
}

export interface CommandSafetyCheck {
  isDestructive: boolean;
  category: string;
  reason?: string;
}

export interface ServerExecutionResult {
  serverId: number;
  serverName: string;
  hostname: string;
  port: number;
  success: boolean;
  exitCode: number;
  output: string;
  error?: string | null;
  durationMs: number;
}

export interface BroadcastResponse {
  command: string;
  executedAt: string;
  totalTargets: number;
  successCount: number;
  failedCount: number;
  results: Record<string, ServerExecutionResult>;
}

