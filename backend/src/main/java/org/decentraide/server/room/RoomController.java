package org.decentraide.server.room;

import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = "*")
public class RoomController {

  public static class RoomSession {
    private final String roomId;
    private final String name;
    private final String hostPeerId;
    private final Set<String> peers = ConcurrentHashMap.newKeySet();
    private final long createdAt;

    public RoomSession(String roomId, String name, String hostPeerId) {
      this.roomId = roomId;
      this.name = name;
      this.hostPeerId = hostPeerId;
      this.createdAt = System.currentTimeMillis();
      if (hostPeerId != null && !hostPeerId.isEmpty()) {
        this.peers.add(hostPeerId);
      }
    }

    public String getRoomId() { return roomId; }
    public String getName() { return name; }
    public String getHostPeerId() { return hostPeerId; }
    public Set<String> getPeers() { return peers; }
    public long getCreatedAt() { return createdAt; }
  }

  private final Map<String, RoomSession> rooms = new ConcurrentHashMap<>();

  @PostMapping("/create")
  public Map<String, Object> createRoom(@RequestBody Map<String, String> body) {
    String name = body.getOrDefault("name", "DecentraBank");
    String peerId = body.getOrDefault("peerId", "peer-host-a");

    // Room ID format matching spec §3 e.g., DB-72A91
    String randomSuffix = UUID.randomUUID().toString().substring(0, 5).toUpperCase();
    String roomId = "DB-" + randomSuffix;

    RoomSession session = new RoomSession(roomId, name, peerId);
    rooms.put(roomId, session);

    return Map.of(
      "success", true,
      "roomId", roomId,
      "name", name,
      "peers", session.getPeers()
    );
  }

  @PostMapping("/join")
  public Map<String, Object> joinRoom(@RequestBody Map<String, String> body) {
    String roomId = body.get("roomId");
    String peerId = body.getOrDefault("peerId", "peer-joiner");

    if (roomId == null || !rooms.containsKey(roomId.toUpperCase())) {
      return Map.of("success", false, "error", "Room ID not found");
    }

    RoomSession session = rooms.get(roomId.toUpperCase());
    session.getPeers().add(peerId);

    return Map.of(
      "success", true,
      "roomId", session.getRoomId(),
      "name", session.getName(),
      "peers", session.getPeers()
    );
  }

  @GetMapping("/{roomId}")
  public Map<String, Object> getRoomInfo(@PathVariable String roomId) {
    RoomSession session = rooms.get(roomId.toUpperCase());
    if (session == null) {
      return Map.of("success", false, "error", "Room not found");
    }
    return Map.of(
      "success", true,
      "roomId", session.getRoomId(),
      "name", session.getName(),
      "peers", session.getPeers()
    );
  }
}
