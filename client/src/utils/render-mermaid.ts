// Lazily load mermaid (a ~3MB chunk) only when the page actually contains
// diagram blocks. Importing mermaid statically pulled the whole library into
// every article/editor page even when no diagram was present.
export async function renderMermaidDiagrams() {
  const lightNodes = document.querySelectorAll<HTMLElement>("pre.mermaid_default");
  const darkNodes = document.querySelectorAll<HTMLElement>("pre.mermaid_dark");
  if (lightNodes.length === 0 && darkNodes.length === 0) {
    return;
  }

  const { default: mermaid } = await import("mermaid");

  mermaid.initialize({ startOnLoad: false, theme: "default" });
  await mermaid.run({ suppressErrors: true, nodes: lightNodes });

  mermaid.initialize({ startOnLoad: false, theme: "dark" });
  await mermaid.run({ suppressErrors: true, nodes: darkNodes });
}
