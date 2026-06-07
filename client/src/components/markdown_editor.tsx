import Editor from '@monaco-editor/react';
import { editor, Range, type IRange } from 'monaco-editor';
import React, { useRef, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import Loading from 'react-loading';
import { FlatInset, FlatTabButton } from "@rin/ui";
import { useAlert } from "./dialog";
import { useColorMode } from "../utils/darkModeUtils";
import { buildMarkdownImage, getImageUploadErrorMessage, isImageFile, uploadImageFile } from "../utils/image-upload";
import { buildMarkdownVideo, getVideoUploadErrorMessage, isVideoFile, uploadVideoFile } from "../utils/video-upload";
import { Markdown } from "./markdown";


interface MarkdownEditorProps {
  content: string;
  setContent: (content: string) => void;
  placeholder?: string;
  height?: string;
}

function rangeAfterInsert(
  model: editor.ITextModel,
  range: IRange,
  text: string,
): Range {
  const startOffset = model.getOffsetAt({
    lineNumber: range.startLineNumber,
    column: range.startColumn,
  });
  const endPos = model.getPositionAt(startOffset + text.length);
  return new Range(endPos.lineNumber, endPos.column, endPos.lineNumber, endPos.column);
}

export function MarkdownEditor({ content, setContent, placeholder = "> Write your content here...", height = "400px" }: MarkdownEditorProps) {
  const { t } = useTranslation();
  const colorMode = useColorMode();
  const editorRef = useRef<editor.IStandaloneCodeEditor>();
  const isComposingRef = useRef(false);
  const [preview, setPreview] = useState<'edit' | 'preview' | 'comparison'>('edit');
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const videoUploadRef = useRef<HTMLInputElement>(null);
  const { showAlert, AlertUI } = useAlert();

  const insertImages = useCallback(async (files: File[]) => {
    const imageFiles = files.filter(isImageFile);
    if (imageFiles.length === 0) {
      return;
    }

    const editorInstance = editorRef.current;
    if (!editorInstance) {
      return;
    }

    const selection = editorInstance.getSelection();
    if (!selection) {
      return;
    }

    let insertRange: IRange = selection;

    setUploading(true);
    try {
      for (const file of imageFiles) {
        const model = editorInstance.getModel();
        if (!model) {
          break;
        }

        try {
          const result = await uploadImageFile(file);
          const text = buildMarkdownImage(file.name, result.url, {
            blurhash: result.blurhash,
            width: result.width,
            height: result.height,
          });
          editorInstance.executeEdits("insert-image", [{
            range: insertRange,
            text,
            forceMoveMarkers: true,
          }]);
          insertRange = rangeAfterInsert(model, insertRange, text);
          setContent(editorInstance.getValue());
        } catch (error) {
          console.error(error);
          showAlert(getImageUploadErrorMessage(error, t));
        }
      }
    } finally {
      setUploading(false);
    }
  }, [setContent, showAlert, t]);

  const handleUploadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.currentTarget.files;
    if (!selected || selected.length === 0) {
      return;
    }
    void insertImages(Array.from(selected)).finally(() => {
      if (uploadRef.current) {
        uploadRef.current.value = "";
      }
    });
  };

  const insertVideos = useCallback(async (files: File[]) => {
    const videoFiles = files.filter(isVideoFile);
    if (videoFiles.length === 0) {
      return;
    }

    const editorInstance = editorRef.current;
    if (!editorInstance) {
      return;
    }

    const selection = editorInstance.getSelection();
    if (!selection) {
      return;
    }

    let insertRange: IRange = selection;

    setUploadingVideo(true);
    try {
      for (const file of videoFiles) {
        const model = editorInstance.getModel();
        if (!model) {
          break;
        }

        try {
          const result = await uploadVideoFile(file);
          const text = buildMarkdownVideo(result.url);
          editorInstance.executeEdits("insert-video", [{
            range: insertRange,
            text,
            forceMoveMarkers: true,
          }]);
          insertRange = rangeAfterInsert(model, insertRange, text);
          setContent(editorInstance.getValue());
        } catch (error) {
          console.error(error);
          showAlert(getVideoUploadErrorMessage(error));
        }
      }
    } finally {
      setUploadingVideo(false);
    }
  }, [setContent, showAlert]);

  const handleVideoUploadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.currentTarget.files;
    if (!selected || selected.length === 0) {
      return;
    }
    void insertVideos(Array.from(selected)).finally(() => {
      if (videoUploadRef.current) {
        videoUploadRef.current.value = "";
      }
    });
  };

  const handlePaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    const imageFiles = Array.from(event.clipboardData.files).filter(isImageFile);
    if (imageFiles.length === 0) {
      return;
    }

    event.preventDefault();
    const editorInstance = editorRef.current;
    if (!editorInstance) {
      return;
    }
    editorInstance.trigger(undefined, "undo", undefined);
    await insertImages(imageFiles);
  };

  /* ---------------- Markdown formatting toolbar ---------------- */

  const applyWrap = useCallback((prefix: string, suffix: string, placeholder: string) => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    const selection = ed?.getSelection();
    if (!ed || !model || !selection) return;
    const selected = model.getValueInRange(selection);
    const text = `${prefix}${selected || placeholder}${suffix}`;
    ed.executeEdits("format-wrap", [{ range: selection, text, forceMoveMarkers: true }]);
    setContent(ed.getValue());
    ed.focus();
  }, [setContent]);

  const applyLinePrefix = useCallback((linePrefix: string) => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    const selection = ed?.getSelection();
    if (!ed || !model || !selection) return;
    const edits = [];
    for (let line = selection.startLineNumber; line <= selection.endLineNumber; line++) {
      edits.push({ range: new Range(line, 1, line, 1), text: linePrefix, forceMoveMarkers: true });
    }
    ed.executeEdits("format-line", edits);
    setContent(ed.getValue());
    ed.focus();
  }, [setContent]);

  const applyCodeBlock = useCallback(() => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    const selection = ed?.getSelection();
    if (!ed || !model || !selection) return;
    const selected = model.getValueInRange(selection);
    const text = "```js\n" + (selected || "") + "\n```\n";
    ed.executeEdits("format-codeblock", [{ range: selection, text, forceMoveMarkers: true }]);
    setContent(ed.getValue());
    ed.focus();
  }, [setContent]);

  const formatButtons = [
    { icon: "ri-h-2", title: t("editor.toolbar.heading"), run: () => applyLinePrefix("## ") },
    { icon: "ri-bold", title: t("editor.toolbar.bold"), run: () => applyWrap("**", "**", t("editor.toolbar.bold_text")) },
    { icon: "ri-italic", title: t("editor.toolbar.italic"), run: () => applyWrap("*", "*", t("editor.toolbar.italic_text")) },
    { icon: "ri-double-quotes-l", title: t("editor.toolbar.quote"), run: () => applyLinePrefix("> ") },
    { icon: "ri-list-unordered", title: t("editor.toolbar.list"), run: () => applyLinePrefix("- ") },
    { icon: "ri-code-line", title: t("editor.toolbar.inline_code"), run: () => applyWrap("`", "`", "code") },
    { icon: "ri-code-box-line", title: t("editor.toolbar.code_block"), run: applyCodeBlock },
    { icon: "ri-link", title: t("editor.toolbar.link"), run: () => applyWrap("[", "](https://)", t("editor.toolbar.link_text")) },
  ];

  /* ---------------- Monaco Mount & IME Optimization ---------------- */

  const handleEditorMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    editor.onDidCompositionStart(() => {
      isComposingRef.current = true;
    });

    editor.onDidCompositionEnd(() => {
      isComposingRef.current = false;
      setContent(editor.getValue());
    });

    editor.onDidChangeModelContent(() => {
      if (!isComposingRef.current) {
        setContent(editor.getValue());
      }
    });

    editor.onDidBlurEditorText(() => {
      setContent(editor.getValue());
    });
  };

  /* ---------------- synchronization ---------------- */

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const model = editor.getModel();
    if (!model) return;

    const editorValue = model.getValue();

    // Avoid infinite loops & prevent overwriting content being edited
    if (editorValue !== content) {
      editor.setValue(content);
    }
  }, [content]);

  /* ---------------- UI ---------------- */

  return (
    <div className="flex flex-col gap-0 sm:gap-3">
      <FlatInset className="flex flex-wrap items-center gap-2 border-0 border-b border-black/10 rounded-none bg-transparent p-3 dark:border-white/10">
        <FlatTabButton active={preview === 'edit'} onClick={() => setPreview('edit')}> {t("edit")} </FlatTabButton>
        <FlatTabButton active={preview === 'preview'} onClick={() => setPreview('preview')}> {t("preview")} </FlatTabButton>
        <FlatTabButton active={preview === 'comparison'} onClick={() => setPreview('comparison')}> {t("comparison")} </FlatTabButton>
        <div className="flex-grow" />
        <input
          ref={uploadRef}
          onChange={handleUploadChange}
          className="hidden"
          type="file"
          multiple
          accept="image/gif,image/jpeg,image/jpg,image/png,image/webp"
        />
        <button
          type="button"
          onClick={() => uploadRef.current?.click()}
          disabled={uploading}
          title={t("upload.image.multi_select_hint")}
          className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-w px-3 py-2 text-sm t-primary transition-colors hover:border-black/20 disabled:opacity-50 dark:border-white/10 dark:hover:border-white/20"
        >
          <i className="ri-image-add-line" />
          <span>{t("upload.image.multi_select")}</span>
        </button>
        <input
          ref={videoUploadRef}
          onChange={handleVideoUploadChange}
          className="hidden"
          type="file"
          multiple
          accept="video/mp4,video/webm,video/ogg,video/quicktime,.mp4,.webm,.ogg,.mov,.m4v"
        />
        <button
          type="button"
          onClick={() => videoUploadRef.current?.click()}
          disabled={uploadingVideo}
          title={t("upload.video.hint")}
          className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-w px-3 py-2 text-sm t-primary transition-colors hover:border-black/20 disabled:opacity-50 dark:border-white/10 dark:hover:border-white/20"
        >
          <i className="ri-video-add-line" />
          <span>{t("upload.video.select")}</span>
        </button>
        {(uploading || uploadingVideo) &&
          <div className="flex flex-row items-center space-x-2">
            <Loading type="spin" color="#FC466B" height={16} width={16} />
            <span className="text-sm text-neutral-500">{t('uploading')}</span>
          </div>
        }
      </FlatInset>
      {preview !== 'preview' && (
        <FlatInset className="flex flex-wrap items-center gap-1 border-0 border-b border-black/10 rounded-none bg-transparent px-3 py-2 dark:border-white/10">
          {formatButtons.map((button) => (
            <button
              key={button.icon}
              type="button"
              title={button.title}
              aria-label={button.title}
              onClick={button.run}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg t-primary transition-colors hover:bg-secondary"
            >
              <i className={button.icon} />
            </button>
          ))}
        </FlatInset>
      )}
      <div className={`grid grid-cols-1 gap-0 sm:gap-4 ${preview === 'comparison' ? "lg:grid-cols-2" : ""}`}>
        <div className={"flex min-w-0 flex-col " + (preview === 'preview' ? "hidden" : "")}>
          <div
            className={"relative min-h-0 overflow-hidden rounded-none border-0 bg-w"}
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const dropped = Array.from(e.dataTransfer.files).filter(isImageFile);
              if (dropped.length === 0) {
                return;
              }
              void insertImages(dropped);
            }}
            onPaste={handlePaste}
          >
            <Editor
              onMount={handleEditorMount}
              height={height}
              defaultLanguage="markdown"
              defaultValue={content}
              theme={colorMode === "dark" ? "vs-dark" : "light"}
              options={{
                wordWrap: "on",

                // Chinese IME stability key
                fontFamily: "Sarasa Mono SC, JetBrains Mono, monospace",
                fontLigatures: false,
                letterSpacing: 0,

                fontSize: 14,
                lineNumbers: "off",

                accessibilitySupport: "off",
                unicodeHighlight: { ambiguousCharacters: false },

                renderWhitespace: "none",
                renderControlCharacters: false,
                smoothScrolling: false,

                dragAndDrop: true,
                pasteAs: { enabled: false },
              }}
            />
          </div>
        </div>
        <div
          className={"min-h-0 overflow-y-auto rounded-none border-0 bg-w px-4 py-4 border-t sm:border-none " + (preview === 'edit' ? "hidden" : "")}
          style={{ height: height }}
        >
          <Markdown content={content ? content : placeholder} />
        </div>
      </div>
      <AlertUI />
    </div>
  );
}
