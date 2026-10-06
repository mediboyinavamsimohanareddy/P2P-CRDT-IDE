package org.decentraide.server;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.decentraide.server.identity.IdentityController;
import org.decentraide.server.project.ProjectController;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class ServerEndpointsTest {

  @Autowired
  private IdentityController identityController;

  @Autowired
  private ProjectController projectController;

  @Test
  void testIdentityAndProjectEndpoints() {
    // Register Identity
    Map<String, Object> regRes = identityController.register(Map.of(
      "peerId", "peer-123",
      "displayName", "Arjun",
      "publicKeyPem", "pem-key"
    ));
    assertTrue((Boolean) regRes.get("success"));

    // Lookup Identity
    Map<String, Object> getRes = identityController.getIdentity("peer-123");
    assertTrue((Boolean) getRes.get("success"));

    // Create Project
    Map<String, Object> projRes = projectController.createProject(Map.of(
      "name", "DecentraBank",
      "ownerPeerId", "peer-123"
    ));
    assertTrue((Boolean) projRes.get("success"));
    assertNotNull(projRes.get("projectId"));
  }
}
