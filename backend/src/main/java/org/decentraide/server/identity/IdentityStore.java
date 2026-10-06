package org.decentraide.server.identity;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class IdentityStore {
  private final Map<String, PeerRecord> peers = new ConcurrentHashMap<>();

  public record PeerRecord(String peerId, String displayName, String publicKeyPem) {}

  public void register(String peerId, String displayName, String publicKeyPem) {
    peers.put(peerId, new PeerRecord(peerId, displayName, publicKeyPem));
  }

  public PeerRecord get(String peerId) {
    return peers.get(peerId);
  }
}
