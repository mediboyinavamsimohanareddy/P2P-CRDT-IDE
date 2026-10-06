package org.decentraide.server.identity;

import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/identity")
public class IdentityController {
  private final IdentityStore identityStore = new IdentityStore();

  @PostMapping("/register")
  public Map<String, Object> register(@RequestBody Map<String, String> body) {
    String peerId = body.get("peerId");
    String displayName = body.get("displayName");
    String publicKeyPem = body.get("publicKeyPem");

    if (peerId == null || publicKeyPem == null) {
      return Map.of("success", false, "error", "Missing peerId or publicKeyPem");
    }

    identityStore.register(peerId, displayName, publicKeyPem);
    return Map.of("success", true, "peerId", peerId);
  }

  @GetMapping("/{peerId}")
  public Map<String, Object> getIdentity(@PathVariable String peerId) {
    IdentityStore.PeerRecord peer = identityStore.get(peerId);
    if (peer == null) {
      return Map.of("success", false, "error", "Peer not found");
    }
    return Map.of("success", true, "peer", peer);
  }
}
