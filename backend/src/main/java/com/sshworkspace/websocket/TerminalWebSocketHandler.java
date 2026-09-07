package com.sshworkspace.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sshworkspace.service.SshSessionManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.net.URI;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class TerminalWebSocketHandler extends TextWebSocketHandler {

    private final SshSessionManager sshSessionManager;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String sessionId = extractSessionId(session.getUri());
        if (sessionId == null) {
            log.warn("WebSocket rejected: missing session ID");
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        log.info("WebSocket connected for terminal session: {}", sessionId);
        try {
            sshSessionManager.attachWebSocket(sessionId, session);
        } catch (Exception e) {
            log.error("Failed to attach WebSocket to SSH session {}: {}", sessionId, e.getMessage());
            String errorMsg = objectMapper.writeValueAsString(Map.of(
                    "type", "STATUS",
                    "status", "ERROR",
                    "message", e.getMessage() != null ? e.getMessage() : "Failed to open remote terminal"
            ));
            session.sendMessage(new TextMessage(errorMsg));
            session.close(CloseStatus.SERVER_ERROR);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String sessionId = extractSessionId(session.getUri());
        if (sessionId == null) return;

        try {
            JsonNode root = objectMapper.readTree(message.getPayload());
            String type = root.has("type") ? root.get("type").asText() : "";

            if ("INPUT".equalsIgnoreCase(type)) {
                String data = root.has("data") ? root.get("data").asText() : "";
                sshSessionManager.handleInput(sessionId, data);
            } else if ("RESIZE".equalsIgnoreCase(type)) {
                int cols = root.has("cols") ? root.get("cols").asInt(120) : 120;
                int rows = root.has("rows") ? root.get("rows").asInt(30) : 30;
                sshSessionManager.handleResize(sessionId, cols, rows);
            }
        } catch (Exception e) {
            log.warn("Failed to process WebSocket terminal frame for session {}: {}", sessionId, e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String sessionId = extractSessionId(session.getUri());
        if (sessionId != null) {
            log.info("WebSocket closed for terminal session: {} with status: {}", sessionId, status);
            sshSessionManager.detachWebSocket(sessionId, session);
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        String sessionId = extractSessionId(session.getUri());
        log.warn("WebSocket transport error for session {}: {}", sessionId, exception.getMessage());
        if (sessionId != null) {
            sshSessionManager.detachWebSocket(sessionId, session);
        }
    }

    private String extractSessionId(URI uri) {
        if (uri == null) return null;
        String path = uri.getPath();
        if (path == null) return null;
        String[] parts = path.split("/");
        return parts.length > 0 ? parts[parts.length - 1] : null;
    }
}
