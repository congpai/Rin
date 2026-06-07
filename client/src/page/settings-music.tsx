import { SettingsCard, SettingsCardBody, SettingsCardHeader, SettingsCardRow } from "@rin/ui";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../components/button";
import {
  parseCustomMusicTracks,
  parseMusicPlatformSources,
  serializeCustomMusicTracks,
  serializeMusicPlatformSources,
  type CustomMusicTrack,
  type MusicPlatformSource,
} from "../utils/music-config";
import { MUSIC_SERVERS, MUSIC_TYPES } from "../hooks/useSiteConfig";
import { SearchableSelect } from "@rin/ui";
import { getAudioUploadErrorMessage, uploadAudioFile } from "../utils/audio-upload";

function emptyTrack(): CustomMusicTrack {
  return {
    name: "",
    artist: "",
    url: "",
    cover: "",
  };
}

function emptyPlatformSource(): MusicPlatformSource {
  return {
    server: "tencent",
    type: "playlist",
    id: "",
  };
}

export function SettingsMusicSourcesEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const sources = useMemo(() => parseMusicPlatformSources(value), [value]);

  function updateSources(nextSources: MusicPlatformSource[]) {
    onChange(serializeMusicPlatformSources(
      nextSources.filter((source) => source.id.trim() || source.server || source.type),
    ));
  }

  function updateSource(index: number, patch: Partial<MusicPlatformSource>) {
    const nextSources = sources.map((source, currentIndex) => (
      currentIndex === index ? { ...source, ...patch } : source
    ));
    updateSources(nextSources);
  }

  function addSource() {
    updateSources([...sources, emptyPlatformSource()]);
  }

  function removeSource(index: number) {
    updateSources(sources.filter((_, currentIndex) => currentIndex !== index));
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {sources.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("settings.music.sources.empty")}</p>
      ) : null}
      {sources.map((source, index) => (
        <SettingsCard key={`music-source-${index}`}>
          <SettingsCardBody>
            <div className="space-y-3">
              <SettingsCardRow
                header={
                  <SettingsCardHeader
                    title={t("settings.music.sources.item_title", { index: index + 1 })}
                    description={t("settings.music.sources.item_desc")}
                  />
                }
                action={(
                  <Button
                    title={t("settings.music.sources.remove")}
                    secondary
                    onClick={() => removeSource(index)}
                  />
                )}
              />
              <SettingsCardRow
                header={(
                  <SettingsCardHeader
                    title={t("settings.music.server.title")}
                    description={t("settings.music.server.desc")}
                  />
                )}
                action={(
                  <SearchableSelect
                    value={source.server}
                    onChange={(nextValue) => updateSource(index, { server: nextValue })}
                    options={MUSIC_SERVERS.map((server) => ({
                      label: t(`settings.music.server.options.${server}`),
                      value: server,
                    }))}
                    placeholder={t("settings.music.server.title")}
                  />
                )}
              />
              <SettingsCardRow
                header={(
                  <SettingsCardHeader
                    title={t("settings.music.type.title")}
                    description={t("settings.music.type.desc")}
                  />
                )}
                action={(
                  <SearchableSelect
                    value={source.type}
                    onChange={(nextValue) => updateSource(index, { type: nextValue })}
                    options={MUSIC_TYPES.map((type) => ({
                      label: t(`settings.music.type.options.${type}`),
                      value: type,
                    }))}
                    placeholder={t("settings.music.type.title")}
                  />
                )}
              />
              <label className="block space-y-1">
                <span className="text-sm text-neutral-500">{t("settings.music.id.label")}</span>
                <input
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-neutral-900"
                  value={source.id}
                  placeholder={t("settings.music.id.label")}
                  onChange={(event) => updateSource(index, { id: event.target.value })}
                />
              </label>
            </div>
          </SettingsCardBody>
        </SettingsCard>
      ))}
      <Button
        title={t("settings.music.sources.add")}
        secondary
        onClick={addSource}
      />
    </div>
  );
}

export function SettingsMusicTracksEditor({
  value,
  onChange,
  onError,
}: {
  value: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadIndex, setUploadIndex] = useState<number | null>(null);
  const tracks = useMemo(() => {
    const parsed = parseCustomMusicTracks(value);
    return parsed.length > 0 ? parsed : [emptyTrack()];
  }, [value]);

  function updateTracks(nextTracks: CustomMusicTrack[]) {
    onChange(serializeCustomMusicTracks(nextTracks.filter((track) => track.url.trim() || track.name.trim() || track.artist.trim())));
  }

  function updateTrack(index: number, patch: Partial<CustomMusicTrack>) {
    const nextTracks = tracks.map((track, currentIndex) => (
      currentIndex === index ? { ...track, ...patch } : track
    ));
    updateTracks(nextTracks);
  }

  function addTrack() {
    updateTracks([...tracks, emptyTrack()]);
  }

  function removeTrack(index: number) {
    const nextTracks = tracks.filter((_, currentIndex) => currentIndex !== index);
    updateTracks(nextTracks.length > 0 ? nextTracks : [emptyTrack()]);
  }

  async function handleUpload(index: number, file: File | undefined) {
    if (!file) {
      return;
    }
    setUploadIndex(index);
    try {
      const { url } = await uploadAudioFile(file);
      updateTrack(index, {
        url,
        name: tracks[index]?.name || file.name.replace(/\.[^.]+$/, ""),
      });
    } catch (error) {
      onError(getAudioUploadErrorMessage(error));
    } finally {
      setUploadIndex(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {tracks.map((track, index) => (
        <SettingsCard key={`music-track-${index}`}>
          <SettingsCardBody>
            <div className="space-y-3">
            <SettingsCardRow
              header={
                <SettingsCardHeader
                  title={t("settings.music.custom.track_title", { index: index + 1 })}
                  description={t("settings.music.custom.track_desc")}
                />
              }
              action={
                tracks.length > 1 ? (
                  <Button
                    title={t("settings.music.custom.remove")}
                    secondary
                    onClick={() => removeTrack(index)}
                  />
                ) : null
              }
            />
            <label className="block space-y-1">
              <span className="text-sm text-neutral-500">{t("settings.music.custom.name")}</span>
              <input
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-neutral-900"
                value={track.name}
                placeholder={t("settings.music.custom.name")}
                onChange={(event) => updateTrack(index, { name: event.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm text-neutral-500">{t("settings.music.custom.artist")}</span>
              <input
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-neutral-900"
                value={track.artist}
                placeholder={t("settings.music.custom.artist")}
                onChange={(event) => updateTrack(index, { artist: event.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm text-neutral-500">{t("settings.music.custom.url")}</span>
              <input
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-neutral-900"
                value={track.url}
                placeholder="https://example.com/song.mp3"
                onChange={(event) => updateTrack(index, { url: event.target.value })}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                ref={index === 0 ? fileInputRef : undefined}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.flac,.aac,.m4a"
                className="hidden"
                onChange={(event) => {
                  void handleUpload(index, event.target.files?.[0]);
                }}
              />
              <Button
                title={uploadIndex === index
                  ? t("settings.music.custom.uploading")
                  : t("settings.music.custom.upload")}
                secondary
                disabled={uploadIndex === index}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "audio/*,.mp3,.wav,.ogg,.flac,.aac,.m4a";
                  input.onchange = () => {
                    void handleUpload(index, input.files?.[0]);
                  };
                  input.click();
                }}
              />
            </div>
          </div>
          </SettingsCardBody>
        </SettingsCard>
      ))}
      <Button
        title={t("settings.music.custom.add")}
        secondary
        onClick={addTrack}
      />
    </div>
  );
}
