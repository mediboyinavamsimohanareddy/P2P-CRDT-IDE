package org.decentraide.server.runtime;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;

public final class LanAddressResolver {
  private LanAddressResolver() {}

  public static List<String> ipv4Addresses() {
    List<String> addresses = new ArrayList<>();
    try {
      Enumeration<NetworkInterface> ifaces = NetworkInterface.getNetworkInterfaces();
      while (ifaces.hasMoreElements()) {
        NetworkInterface ni = ifaces.nextElement();
        if (!ni.isUp() || ni.isLoopback() || ni.isVirtual()) {
          continue;
        }
        for (InetAddress addr : Collections.list(ni.getInetAddresses())) {
          if (addr instanceof Inet4Address && !addr.isLoopbackAddress() && !addr.isLinkLocalAddress()) {
            addresses.add(addr.getHostAddress());
          }
        }
      }
    } catch (Exception ignored) {
      // No LAN address available
    }
    return addresses;
  }
}
