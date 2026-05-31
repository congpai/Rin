const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
    {
        label: "常用",
        emojis: ["😀", "😂", "🥹", "😊", "😍", "🤔", "👍", "👏", "🎉", "❤️", "🔥", "✨"],
    },
    {
        label: "表情",
        emojis: ["😎", "🙂", "😢", "😭", "😡", "🤯", "😱", "🥳", "😴", "🤗", "🙏", "💪"],
    },
    {
        label: "符号",
        emojis: ["⭐", "💯", "✅", "❌", "👀", "💡", "📌", "🎵", "🌸", "🍵", "☕", "🌙"],
    },
];

type EmojiPickerProps = {
    onPick: (emoji: string) => void;
};

export function EmojiPicker({ onPick }: EmojiPickerProps) {
    return (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-xl border border-black/10 bg-w p-3 shadow-lg dark:border-white/10">
            {EMOJI_GROUPS.map((group) => (
                <div key={group.label} className="mb-2 last:mb-0">
                    <p className="mb-1 text-xs text-neutral-500">{group.label}</p>
                    <div className="flex flex-wrap gap-1">
                        {group.emojis.map((emoji) => (
                            <button
                                key={emoji}
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-secondary"
                                onClick={() => onPick(emoji)}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
