import { APP_NAME, getHealthCheck } from '@decentraide/shared';

export function startDesktopApp(): string {
  const health = getHealthCheck();
  return `${APP_NAME} Desktop App started with status: ${health.status}`;
}
