export type GuestCommentProfile = {
    name: string;
    email: string;
    website: string;
};

const KEYS = {
    name: "rin/guest_comment/name",
    email: "rin/guest_comment/email",
    website: "rin/guest_comment/website",
} as const;

function canUseStorage() {
    try {
        if (typeof localStorage === "undefined") return false;
        localStorage.setItem("__rin_guest_test__", "1");
        localStorage.removeItem("__rin_guest_test__");
        return true;
    } catch {
        return false;
    }
}

export function readGuestCommentProfile(): GuestCommentProfile {
    if (!canUseStorage()) {
        return { name: "", email: "", website: "" };
    }
    return {
        name: localStorage.getItem(KEYS.name) ?? "",
        email: localStorage.getItem(KEYS.email) ?? "",
        website: localStorage.getItem(KEYS.website) ?? "",
    };
}

export function writeGuestCommentProfile(profile: GuestCommentProfile) {
    if (!canUseStorage()) return;
    for (const [key, storageKey] of Object.entries(KEYS) as [keyof GuestCommentProfile, string][]) {
        const value = profile[key].trim();
        if (value) localStorage.setItem(storageKey, value);
        else localStorage.removeItem(storageKey);
    }
}
