package org.decentraide.server.runtime;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/runtime")
@CrossOrigin(origins = "*")
public class RuntimeController {

  @Value("${server.port:8082}")
  private int serverPort;

  @GetMapping("/lan-info")
  public Map<String, Object> lanInfo() {
    List<String> addresses = LanAddressResolver.ipv4Addresses();
    String primary = addresses.isEmpty() ? "127.0.0.1" : addresses.get(0);
    return Map.of(
      "success", true,
      "port", serverPort,
      "addresses", addresses,
      "primaryAddress", primary,
      "signalingUrl", "http://" + primary + ":" + serverPort,
      "inviteHint", "On the second laptop open http://" + primary + ":5173 or set signaling host " + primary + ":" + serverPort
    );
  }
}
