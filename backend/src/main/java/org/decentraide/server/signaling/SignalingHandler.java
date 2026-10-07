package org.decentraide.server.signaling;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

/**
 * Relays SDP/ICE only within the same room. Never stores source or CRDT state.
 */
public class SignalingHandler extends TextWebSocketHandler {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Map<String, Set<WebSocketSession>> ROOM_SESSIONS = new ConcurrentHashMap<>();
  private static final Map<String, String> SESSION_ROOM = new ConcurrentHashMap<>();

  @Override
  protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
    JsonNode root;
    try {
      root = MAPPER.readTree(message.getPayload());
    } catch (Exception e) {
      return;
    }

    String roomId = text(root, "roomId");
    if (roomId == null || roomId.isBlank()) {
      return;
    }
    roomId = roomId.toUpperCase();
    bindSession(session, roomId, text(root, "from"));

    String target = text(root, "target");
    Set<WebSocketSession> room = ROOM_SESSIONS.get(roomId);
    if (room == null) {
      return;
    }

    for (WebSocketSession other : room) {
      if (!other.isOpen() || other.getId().equals(session.getId())) {
        continue;
      }
      if (target != null && !target.isBlank()) {
        Object peerAttr = other.getAttributes().get("peerId");
        if (peerAttr != null && !target.equals(String.valueOf(peerAttr))) {
          continue;
        }
      }
      other.sendMessage(message);
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

  private void bindSession(WebSocketSession session, String roomId, String peerId) {
    String previous = SESSION_ROOM.put(session.getId(), roomId);
    if (previous != null && !previous.equals(roomId)) {
      Set<WebSocketSession> old = ROOM_SESSIONS.get(previous);
      if (old != null) {
        old.remove(session);
      }
    }
    ROOM_SESSIONS.computeIfAbsent(roomId, k -> new CopyOnWriteArraySet<>()).add(session);
    if (peerId != null && !peerId.isBlank()) {
      session.getAttributes().put("peerId", peerId);
    }
  }

  private static String text(JsonNode root, String field) {
    JsonNode node = root.get(field);
    return node == null || node.isNull() ? null : node.asText();
  }
}
