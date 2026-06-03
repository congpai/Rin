import { describe, expect, it } from "bun:test";
import {
  buildWranglerObservabilityConfig,
  buildWranglerQueueConfig,
  buildWranglerTriggersConfig,
  collectWorkerSecrets,
  isSecretSyncVersionConflictError,
} from "./deploy-cf";

describe("collectWorkerSecrets", () => {
  it("includes supported non-empty worker secrets", () => {
    const secrets = collectWorkerSecrets({
      JWT_SECRET: "jwt-secret",
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "password",
      RIN_GITHUB_CLIENT_ID: "client-id",
      RIN_GITHUB_CLIENT_SECRET: "client-secret",
      S3_ACCESS_KEY_ID: "access-key",
      S3_SECRET_ACCESS_KEY: "secret-key",
      UNUSED: "ignored",
    });

    expect(secrets).toEqual({
      JWT_SECRET: "jwt-secret",
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "password",
      RIN_GITHUB_CLIENT_ID: "client-id",
      RIN_GITHUB_CLIENT_SECRET: "client-secret",
      S3_ACCESS_KEY_ID: "access-key",
      S3_SECRET_ACCESS_KEY: "secret-key",
    });
  });

  it("omits empty secret values", () => {
    const secrets = collectWorkerSecrets({
      JWT_SECRET: "",
      ADMIN_USERNAME: undefined,
      ADMIN_PASSWORD: "password",
    });

    expect(secrets).toEqual({
      ADMIN_PASSWORD: "password",
    });
  });
});

describe("isSecretSyncVersionConflictError", () => {
  it("detects Cloudflare version conflict errors", () => {
    expect(isSecretSyncVersionConflictError("script edit failed [code: 10214]")).toBe(true);
    expect(isSecretSyncVersionConflictError("latest version isn't currently deployed")).toBe(true);
    expect(isSecretSyncVersionConflictError("upload failed")).toBe(false);
  });
});

describe("buildWranglerTriggersConfig", () => {
  it("omits cron triggers for preview deploys", () => {
    expect(buildWranglerTriggersConfig(true)).toBe("");
  });

  it("includes cron triggers for production deploys", () => {
    expect(buildWranglerTriggersConfig(false)).toContain("[triggers]");
    expect(buildWranglerTriggersConfig(false)).toContain('crons = ["*/20 * * * *"]');
  });
});

describe("buildWranglerQueueConfig", () => {
  it("includes queue consumers for preview deploys", () => {
    const config = buildWranglerQueueConfig("rin-preview-tasks", true);
    expect(config).toContain('queue = "rin-preview-tasks"');
    expect(config).toContain("[[queues.consumers]]");
  });

  it("includes queue consumers for production deploys", () => {
    const config = buildWranglerQueueConfig("rin-tasks", false);
    expect(config).toContain("[[queues.producers]]");
    expect(config).toContain("[[queues.consumers]]");
  });
});

describe("buildWranglerObservabilityConfig", () => {
  it("enables persisted invocation logs and disables traces", () => {
    const config = buildWranglerObservabilityConfig();
    expect(config).toContain("[observability]");
    expect(config).toContain("[observability.logs]");
    expect(config).toContain("persist = true");
    expect(config).toContain("invocation_logs = true");
    expect(config).toContain("[observability.traces]");
    expect(config).toContain("enabled = false");
  });
});
