type LyricLine = {
  time: number;
  text: string;
};

function trimLyric(lyric: string): LyricLine[] {
  const result: LyricLine[] = [];
  for (const line of lyric.split("\n")) {
    const match = line.match(/^\[(\d{2}):(\d{2}\.\d*)\](.*)$/);
    if (!match) {
      continue;
    }
    result.push({
      time: Math.floor(Number.parseInt(match[1], 10) * 60 * 1000 + Number.parseFloat(match[2]) * 1000),
      text: match[3],
    });
  }
  return result.sort((a, b) => a.time - b.time);
}

export function formatMetingLyric(lyric: string, tlyric = ""): string {
  const lyricArray = trimLyric(lyric);
  const tlyricArray = trimLyric(tlyric);
  if (tlyricArray.length === 0) {
    return lyric;
  }

  const result: LyricLine[] = [];
  for (let i = 0, j = 0; i < lyricArray.length && j < tlyricArray.length; i += 1) {
    const time = lyricArray[i].time;
    let text = lyricArray[i].text;
    while (time > tlyricArray[j].time && j + 1 < tlyricArray.length) {
      j += 1;
    }
    if (time === tlyricArray[j].time && tlyricArray[j].text.length) {
      text = `${text} (${tlyricArray[j].text})`;
    }
    result.push({ time, text });
  }

  return result
    .map((line) => {
      const minus = Math.floor(line.time / 60000).toString().padStart(2, "0");
      const second = Math.floor((line.time % 60000) / 1000).toString().padStart(2, "0");
      const millisecond = Math.floor(line.time % 1000).toString().padStart(3, "0");
      return `[${minus}:${second}.${millisecond}]${line.text}`;
    })
    .join("\n");
}
