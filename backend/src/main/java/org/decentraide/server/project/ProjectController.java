package org.decentraide.server.project;

import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {
  private final Map<String, Map<String, Object>> projects = new ConcurrentHashMap<>();

  @PostMapping
  public Map<String, Object> createProject(@RequestBody Map<String, Object> body) {
    String projectId = "P-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    Map<String, Object> projectData = new HashMap<>(body);
    projectData.put("projectId", projectId);
    projects.put(projectId, projectData);
    return Map.of("success", true, "projectId", projectId);
  }

  @GetMapping("/{id}")
  public Map<String, Object> getProject(@PathVariable String id) {
    Map<String, Object> proj = projects.get(id);
    if (proj == null) {
      return Map.of("success", false, "error", "Project not found");
    }
    return Map.of("success", true, "project", proj);
  }
}
