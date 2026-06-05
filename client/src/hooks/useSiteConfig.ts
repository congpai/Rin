import { useContext } from "react";
import { ClientConfigContext } from "../state/config";
import { normalizeFeedCardVariant } from "../components/feed-card-options";
import { normalizeFeedLayout } from "../components/feed-layout-options";

export const MUSIC_SERVERS = ["netease", "tencent", "kugou", "baidu", "kuwo"] as const;
export const MUSIC_TYPES = ["playlist", "song", "album", "artist"] as const;

export type MusicServer = typeof MUSIC_SERVERS[number];
export type MusicType = typeof MUSIC_TYPES[number];

// Site configuration keys
export const SITE_CONFIG_KEYS = {
    headerBehavior: "header.behavior",
    name: "site.name",
    description: "site.description",
    avatar: "site.avatar",
    avatarHover: "site.avatar_hover",
    avatarHoverLabel: "site.avatar_hover_label",
    pageSize: "site.page_size",
    feedLayout: "feed.layout",
    feedCardVariant: "feed.card_variant",
    headerLayout: "header.layout",
    themeColor: "theme.color",
    musicEnabled: "music.enabled",
    musicServer: "music.server",
    musicType: "music.type",
    musicId: "music.id",
    musicAutoplay: "music.autoplay",
} as const;

function parseBoolean(value: unknown, fallback = false) {
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "string") {
        return value === "true" || value === "1";
    }
    return fallback;
}

function normalizeMusicServer(value: string): MusicServer {
    return MUSIC_SERVERS.includes(value as MusicServer) ? value as MusicServer : "netease";
}

function normalizeMusicType(value: string): MusicType {
    return MUSIC_TYPES.includes(value as MusicType) ? value as MusicType : "playlist";
}

// Hook to get site configuration
export function useSiteConfig() {
    const config = useContext(ClientConfigContext);
    const pageSizeValue = config.get<string | number>(SITE_CONFIG_KEYS.pageSize);
    const parsedPageSize =
        typeof pageSizeValue === "number"
            ? pageSizeValue
            : typeof pageSizeValue === "string"
                ? parseInt(pageSizeValue, 10)
                : NaN;

    return {
        name: config.get<string>(SITE_CONFIG_KEYS.name) || "Rin",
        description: config.get<string>(SITE_CONFIG_KEYS.description) || "",
        avatar: config.get<string>(SITE_CONFIG_KEYS.avatar) || "",
        avatarHover: config.get<string>(SITE_CONFIG_KEYS.avatarHover) || "",
        avatarHoverLabel: config.get<string>(SITE_CONFIG_KEYS.avatarHoverLabel) || "",
        pageSize: Number.isFinite(parsedPageSize) ? parsedPageSize : 5,
        headerBehavior: config.get<string>(SITE_CONFIG_KEYS.headerBehavior) || "fixed",
        feedLayout: normalizeFeedLayout(config.get<string>(SITE_CONFIG_KEYS.feedLayout) || "list"),
        feedCardVariant: normalizeFeedCardVariant(config.get<string>(SITE_CONFIG_KEYS.feedCardVariant) || "default"),
        headerLayout: config.get<string>(SITE_CONFIG_KEYS.headerLayout) || "classic",
        themeColor: config.get<string>(SITE_CONFIG_KEYS.themeColor) || "#fc466b",
        musicEnabled: parseBoolean(config.get(SITE_CONFIG_KEYS.musicEnabled)),
        musicServer: normalizeMusicServer(config.get<string>(SITE_CONFIG_KEYS.musicServer) || "netease"),
        musicType: normalizeMusicType(config.get<string>(SITE_CONFIG_KEYS.musicType) || "playlist"),
        musicId: config.get<string>(SITE_CONFIG_KEYS.musicId) || "",
        musicAutoplay: parseBoolean(config.get(SITE_CONFIG_KEYS.musicAutoplay)),
    };
}

// Hook to get a specific site config value
export function useSiteConfigValue<K extends keyof typeof SITE_CONFIG_KEYS>(
    key: K
): typeof SITE_CONFIG_KEYS[K] extends "site.page_size" ? number : string {
    const config = useContext(ClientConfigContext);
    const configKey = SITE_CONFIG_KEYS[key];

    if (key === "pageSize") {
        const value = config.get<string | number>(configKey);
        const parsed =
            typeof value === "number"
                ? value
                : typeof value === "string"
                    ? parseInt(value, 10)
                    : NaN;
        return (Number.isFinite(parsed) ? parsed : 5) as any;
    }

    return (config.get<string>(configKey) || "") as any;
}
