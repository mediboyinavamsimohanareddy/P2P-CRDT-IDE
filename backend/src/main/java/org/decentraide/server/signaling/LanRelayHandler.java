package org.decentraide.server.signaling;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.net.URI;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

/**
 * Room-scoped encrypted-frame relay used when WebRTC ICE is blocked (Wi-Fi client isolation).
 * Forwards ciphertext only. Does not decrypt or persist CRDT state.
 */
public class LanRelayHandler extends TextWebSocketHandler {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Map<String, Set<WebSocketSession>> ROOM_SESSIONS = new ConcurrentHashMap<>();
  private static final Map<String, String> SESSION_ROOM = new ConcurrentHashMap<>();

  @Override
  public void afterConnectionEstablished(WebSocketSession session) {
    String roomId = roomIdFromUri(session.getUri());
    if (roomId != null) {
      bind(session, roomId);
    }
  }

  @Override
  protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
    String roomId = SESSION_ROOM.get(session.getId());
    if (roomId == null) {
      try {
        JsonNode root = MAPPER.readTree(message.getPayload());
        roomId = text(root, "workspaceId");
        if (roomId == null) {
          roomId = text(root, "roomId");
        }
      } catch (Exception ignored) {
        return;
      }
      if (roomId == null || roomId.isBlank()) {
        return;
      }
      bind(session, roomId.toUpperCase());
    }

    Set<WebSocketSession> room = ROOM_SESSIONS.get(roomId);
    if (room == null) {
      return;
    }
    for (WebSocketSession other : room) {
      if (other.isOpen() && !other.getId().equals(session.getId())) {
        other.sendMessage(message);
      }
    }
  }

  @Override
  public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
    String roomId = SESSION_ROOM.remove(session.getId());
    if (roomId == null) {
      return;
    }
    Set<WebSocketSession> room = ROOM_SESSIONS.get(roomId);
    if (room != null) {
      room.remove(session);
      if (room.isEmpty()) {
        ROOM_SESSIONS.remove(roomId);
      }
    }
  }

  private void bind(WebSocketSession session, String roomId) {
    SESSION_ROOM.put(session.getId(), roomId);
    ROOM_SESSIONS.computeIfAbsent(roomId, k -> new CopyOnWriteArraySet<>()).add(session);
  }

  private static String roomIdFromUri(URI uri) {
    if (uri == null || uri.getQuery() == null) {
      return null;
    }
    for (String part : uri.getQuery().split("&")) {
      String[] kv = part.split("=", 2);
      if (kv.length == 2 && kv[0].equals("roomId") && !kv[1].isBlank()) {
        return kv[1].toUpperCase();
      }
    }
    return null;
  }

  private static String text(JsonNode root, String field) {
    JsonNode node = root.get(field);
    return node == null || node.isNull() ? null : node.asText();
  }
}
