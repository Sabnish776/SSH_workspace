-- V2: Service Tunnels & Port Forwarding
CREATE TABLE IF NOT EXISTS service_tunnels (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    server_id BIGINT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    service_type VARCHAR(50) NOT NULL, -- MYSQL, POSTGRES, REDIS, MONGODB, HTTP, CUSTOM
    local_port INT NOT NULL,
    remote_host VARCHAR(255) NOT NULL DEFAULT '127.0.0.1',
    remote_port INT NOT NULL,
    auto_start BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tunnels_user ON service_tunnels(user_id);
CREATE INDEX IF NOT EXISTS idx_tunnels_server ON service_tunnels(server_id);
