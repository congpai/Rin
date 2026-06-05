import type { ReactNode } from "react";
import { Helmet } from "react-helmet";
import type { ConfigWrapper } from "@rin/config";
import type { Profile } from "../state/profile";
import { ClientConfigContext } from "../state/config";
import { ProfileContext } from "../state/profile";
import { GlobalMusicPlayer } from "../components/global-music-player";
import "../components/global-music-player.css";

export function AppProviders({
  children,
  config,
  profile,
}: {
  children: ReactNode;
  config: ConfigWrapper;
  profile: Profile | undefined | null;
}) {
  return (
    <ClientConfigContext.Provider value={config}>
      <ProfileContext.Provider value={profile}>
        <Helmet>
          <link rel="icon" href="/favicon.ico" />
        </Helmet>
        {children}
        <GlobalMusicPlayer />
      </ProfileContext.Provider>
    </ClientConfigContext.Provider>
  );
}
