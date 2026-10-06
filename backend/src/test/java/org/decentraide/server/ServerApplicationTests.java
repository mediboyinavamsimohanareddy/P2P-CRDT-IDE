package org.decentraide.server;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
class ServerApplicationTests {

    @Test
    void contextLoads() {
        HealthController controller = new HealthController();
        assertNotNull(controller.health());
    }
}
