import { useEffect, useRef, useState } from "react";
import { ConfigWrapper } from "@rin/config";
import type { Profile } from "../state/profile";
import { defaultClientConfig } from "../state/config";
import { applyThemeColor } from "../utils/theme-color";
import { readBootstrappedClientConfig } from "./bootstrap-config";
import { client } from "./runtime";

function applyViewportScaling() {
  const highResolutionThreshold = 2560;
  document.documentElement.style.fontSize = window.screen.width >= highResolutionThreshold ? "125%" : "100%";
}

function readSessionConfig() {
  const cachedConfig = sessionStorage.getItem("config");
  if (!cachedConfig) {
    return null;
  }
  try {
    return JSON.parse(cachedConfig) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function useAppBootstrap() {
  const profileLoadedRef = useRef(false);
  const [profile, setProfile] = useState<Profile | undefined | null>(undefined);
  const [config, setConfig] = useState<ConfigWrapper>(() => {
    const bootstrappedConfig = readBootstrappedClientConfig();
    if (bootstrappedConfig) {
      return new ConfigWrapper(bootstrappedConfig, defaultClientConfig);
    }
    const sessionConfig = readSessionConfig();
    if (sessionConfig) {
      return new ConfigWrapper(sessionConfig, defaultClientConfig);
    }
    return new ConfigWrapper({}, defaultClientConfig);
  });

  useEffect(() => {
    applyViewportScaling();
  }, []);

  useEffect(() => {
    const updateClientConfig = (nextConfig: Record<string, unknown>) => {
      sessionStorage.setItem("config", JSON.stringify(nextConfig));
      setConfig(new ConfigWrapper(nextConfig, defaultClientConfig));
      applyThemeColor(typeof nextConfig["theme.color"] === "string" ? nextConfig["theme.color"] : undefined);
    };

    const syncConfigFromSession = () => {
      const sessionConfig = readSessionConfig();
      if (sessionConfig) {
        updateClientConfig(sessionConfig);
      }
    };

    window.addEventListener("storage", syncConfigFromSession);
    window.addEventListener("rin:config-updated", syncConfigFromSession);
    return () => {
      window.removeEventListener("storage", syncConfigFromSession);
      window.removeEventListener("rin:config-updated", syncConfigFromSession);
    };
  }, []);

  useEffect(() => {
    if (profileLoadedRef.current) {
      return;
    }
    profileLoadedRef.current = true;

    client.user.profile().then(({ data, error }) => {
      if (data) {
        setProfile({
          id: data.id,
          avatar: data.avatar || "",
          permission: data.permission,
          name: data.username,
        });
      } else if (error) {
        setProfile(null);
      }
    });
  }, []);

  useEffect(() => {
    const bootstrappedConfig = readBootstrappedClientConfig();
    const sessionConfig = readSessionConfig();
    const initialConfig = bootstrappedConfig ?? sessionConfig;
    if (initialConfig) {
      applyThemeColor(typeof initialConfig["theme.color"] === "string" ? initialConfig["theme.color"] : undefined);
    }
  }, []);

  return { config, profile };
}
