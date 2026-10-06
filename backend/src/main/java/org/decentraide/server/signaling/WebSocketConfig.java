package org.decentraide.server.signaling;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import java.util.concurrent.CopyOnWriteArrayList;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

  @Override
  public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
    registry.addHandler(new SignalingHandler(), "/ws/signaling").setAllowedOrigins("*");
  }

  public static class SignalingHandler extends TextWebSocketHandler {
    private static final CopyOnWriteArrayList<WebSocketSession> sessions = new CopyOnWriteArrayList<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
      sessions.add(session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
      // Relay signaling messages (offer, answer, ice-candidate) to all other sessions
      for (WebSocketSession s : sessions) {
        if (s.isOpen() && !s.getId().equals(session.getId())) {
          s.sendMessage(message);
        }
      }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
      sessions.remove(session);
    }
  }
}
