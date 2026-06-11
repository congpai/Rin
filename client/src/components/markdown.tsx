import "katex/dist/katex.min.css";
import React, { cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  base16AteliersulphurpoolLight,
  vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import gfm from "remark-gfm";
import remarkMermaid from "../remark/remarkMermaid";
import { remarkAlert } from "remark-github-blockquote-alert";
import remarkMath from "remark-math";
import { ImageLightbox } from "./image-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Download from "yet-another-react-lightbox/plugins/download";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { extractMarkdownImages } from "./comment/comment_content";
import { markVariantsUnavailable } from "../utils/variant-availability";
import { useVariantAvailabilityRevision } from "../utils/use-variant-availability-revision";
import { drawBlurhashToCanvas } from "../utils/blurhash";
import { useColorMode } from "../utils/darkModeUtils";
import { parseImageUrlMetadata } from "../utils/image-upload";
import {
  buildLightboxSlides,
  findLightboxIndexByOriginalUrl,
} from "../utils/lightbox-image";
import { buildResponsiveImageProps } from "../utils/responsive-image";
import { useImageLoadState } from "../utils/use-image-load-state";


const countNewlinesBeforeNode = (text: string, offset: number) => {
  let newlinesBefore = 0;
  for (let i = offset - 1; i >= 0; i--) {
    if (text[i] === "\n") {
      newlinesBefore++;
    } else {
      break;
    }
  }
  return newlinesBefore;
};

const isMarkdownImageLinkAtEnd = (text: string) => {
  const trimmed = text.trim();

  const match = trimmed.match(/(.*)(!\\[.*?\\]\\(.*?\\))$/s);

  if (match) {
    const [, beforeImage, _] = match;

    return beforeImage.trim().length === 0 || beforeImage.endsWith("\n");
  }

  return false;
};

function MarkdownImage({
  src,
  alt,
  show,
  rounded,
  scale,
  className,
}: {
  src?: string;
  alt?: string;
  show: (src?: string) => void;
  rounded: boolean;
  scale: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { src: cleanSrc, blurhash, width, height } = parseImageUrlMetadata(src);
  const responsive = buildResponsiveImageProps(
    cleanSrc,
    rounded ? "(max-width: 768px) 100vw, 768px" : "640px",
    rounded ? 768 : 640,
  );
  const [useOriginal, setUseOriginal] = useState(false);
  const displaySrc = useOriginal || !responsive.srcSet ? cleanSrc : responsive.src;
  const { failed, imageRef, loaded, onError, onLoad } = useImageLoadState(displaySrc);
  const roundedClass = rounded ? "rounded-xl" : "";
  const aspectRatio = width && height ? `${width} / ${height}` : undefined;

  useEffect(() => {
    if (!blurhash || !canvasRef.current) {
      return;
    }
    try {
      drawBlurhashToCanvas(canvasRef.current, blurhash);
    } catch (error) {
      console.error("Failed to render blurhash", error);
    }
  }, [blurhash]);

  return (
    <span
      className={`relative inline-block max-w-full overflow-hidden ${roundedClass}`}
      style={{ zoom: scale, aspectRatio }}
    >
      {blurhash && !loaded ? (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full scale-110 blur-sm ${roundedClass}`}
        />
      ) : null}
      <img
        ref={imageRef}
        src={displaySrc}
        srcSet={useOriginal ? undefined : responsive.srcSet}
        sizes={useOriginal ? undefined : responsive.sizes}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        onClick={() => {
          show(cleanSrc);
        }}
        onLoad={onLoad}
        onError={() => {
          if (!useOriginal && responsive.srcSet) {
            markVariantsUnavailable(cleanSrc);
            setUseOriginal(true);
          }
          onError();
        }}
        className={`mx-auto max-w-full cursor-zoom-in transition-opacity ${roundedClass} ${className || ""} ${
          blurhash && (!loaded || failed) ? "opacity-0" : "opacity-100"
        }`}
      />
    </span>
  );
}

function LazyVideo({
  src,
  poster,
  width,
  height,
  style,
}: {
  src?: string;
  poster?: string;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const aspectRatio = width && height ? `${width} / ${height}` : undefined;
  // Older uploads have no poster -> seek to the first frame so a frame shows.
  const videoSrc = src && !poster && !src.includes("#t=") ? `${src}#t=0.1` : src;

  return (
    <span
      ref={ref}
      className="my-4 block w-full overflow-hidden rounded-xl"
      style={{ maxWidth: "100%", aspectRatio, ...style }}
    >
      {inView ? (
        <video
          controls
          playsInline
          preload="none"
          poster={poster}
          src={videoSrc}
          className="h-full w-full max-w-full"
          style={{ width: "100%", height: aspectRatio ? "100%" : undefined }}
        />
      ) : poster ? (
        <img
          src={poster}
          alt=""
          loading="lazy"
          className="h-full w-full max-w-full object-contain"
        />
      ) : (
        <span
          className="block w-full bg-black/5 dark:bg-white/5"
          style={{ aspectRatio: aspectRatio ?? "16 / 9" }}
        />
      )}
    </span>
  );
}

export function Markdown({ content }: { content: string }) {
  const colorMode = useColorMode();
  const [index, setIndex] = React.useState(-1);

  const variantRevision = useVariantAvailabilityRevision();
  const lightboxImages = useMemo(() => extractMarkdownImages(content), [content]);
  const lightboxSlides = useMemo(
    () =>
      buildLightboxSlides(
        lightboxImages.map((image) => ({ url: image.url, alt: image.alt })),
      ),
    [lightboxImages, variantRevision],
  );

  const show = useCallback(
    (src: string | undefined) => {
      if (!src) {
        return;
      }
      const nextIndex = findLightboxIndexByOriginalUrl(
        lightboxImages.map((image) => ({ url: image.url, alt: image.alt })),
        src,
      );
      setIndex(nextIndex);
    },
    [lightboxImages],
  );

  const Content = useMemo(() => (
    <ReactMarkdown
      className="toc-content dark:text-neutral-300"
      remarkPlugins={[gfm, remarkMermaid, remarkMath, remarkAlert]}
      children={content}
      rehypePlugins={[rehypeKatex, rehypeRaw]}
      components={{
        img({ node, src, ...props }) {
          const offset = node!.position!.start.offset!;
          const previousContent = content.slice(0, offset);
          const newlinesBefore = countNewlinesBeforeNode(
            previousContent,
            offset
          );
          const Image = ({
            rounded,
            scale,
          }: {
            rounded: boolean;
            scale: string;
          }) => (
            <MarkdownImage
              src={src}
              alt={props.alt}
              show={show}
              rounded={rounded}
              scale={scale}
              className={props.className}
            />
          );
          if (
            newlinesBefore >= 1 ||
            previousContent.trim().length === 0 ||
            isMarkdownImageLinkAtEnd(previousContent)
          ) {
            return (
              <span className="block w-full text-center my-4">
                <Image scale="0.75" rounded={true} />
              </span>
            );
          } else {
            return (
              <span className="inline-block align-middle mx-1 ">
                <Image scale="0.5" rounded={false} />
              </span>
            );
          }
        },
        code(props) {
          const [copied, setCopied] = React.useState(false);
          const { children, className, node, ...rest } = props;
          const match = /language-(\w+)/.exec(className || "");

          const curContent = content.slice(node?.position?.start.offset || 0);
          const isCodeBlock = curContent.trimStart().startsWith("```");

          const codeBlockStyle = {
            fontFamily: 'ui-monospace, "SFMono-Regular", "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
            fontSize: "14px",
            fontVariantLigatures: "normal",
            WebkitFontFeatureSettings: '"liga" 1',
            fontFeatureSettings: '"liga" 1',
          };

          const inlineCodeStyle = {
            ...codeBlockStyle,
            fontSize: "13px",
          };

          const language = match ? match[1] : "";

          if (isCodeBlock) {
            return (
              <div className="relative group">
                <SyntaxHighlighter
                  PreTag="div"
                  className="rounded"
                  language={language}
                  style={
                    colorMode === "dark"
                      ? vscDarkPlus
                      : base16AteliersulphurpoolLight
                  }
                  wrapLongLines={true}
                  codeTagProps={{ style: codeBlockStyle }}
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
                <button className="absolute top-1 right-1 px-2 py-1 bg-w rounded-md text-sm bg-hover select-none invisible group-hover:visible"
                  onClick={() => {
                    navigator.clipboard.writeText(String(children));
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            );
          } else {
            return (
              <code
                {...rest}
                className={`bg-[#eff1f3] dark:bg-[#4a5061] h-[24px] px-[4px] rounded-md mx-[2px] py-[2px] text-neutral-800 dark:text-neutral-300 ${className || ""
                  }`}
                style={inlineCodeStyle}
              >
                {children}
              </code>
            );
          }
        },
        blockquote({ children, ...props }) {
          return (
            <blockquote
              className="border-l-4 border-gray-300 dark:border-gray-500 pl-4 italic text-gray-500 dark:text-gray-400"
              {...props}
            >
              {children}
            </blockquote>
          );
        },
        em({ children, ...props }) {
          return (
            <em className="ml-[1px] mr-[4px]" {...props}>
              {children}
            </em>
          );
        },
        strong({ children, ...props }) {
          return (
            <strong className="mx-[1px]" {...props}>
              {children}
            </strong>
          );
        },

        ul({ children, className, ...props }) {
          const listClass = className?.includes("contains-task-list")
            ? "list-none pl-5"
            : "list-disc pl-5 mt-2";
          return (
            <ul className={listClass} {...props}>
              {children}
            </ul>
          );
        },
        ol({ children, ...props }) {
          return (
            <ol className="list-decimal pl-5" {...props}>
              {children}
            </ol>
          );
        },
        li({ children, ...props }) {
          return (
            <li className="pl-2 py-1" {...props}>
              {children}
            </li>
          );
        },
        a({ children, ...props }) {
          return (
            <a
              className="text-[#0686c8] dark:text-[#2590f1] hover:underline"
              {...props}
            >
              {children}
            </a>
          );
        },
        h1({ children, ...props }) {
          return (
            <h1
              id={children?.toString()}
              {...props}
              className={`${props.className || ""} text-3xl font-bold mt-4`.trim()}
              style={{ ...props.style, scrollMarginTop: "var(--header-scroll-offset, 7rem)" }}
            >
              {children}
            </h1>
          );
        },
        h2({ children, ...props }) {
          return (
            <h2
              id={children?.toString()}
              {...props}
              className={`${props.className || ""} text-2xl font-bold mt-4`.trim()}
              style={{ ...props.style, scrollMarginTop: "var(--header-scroll-offset, 7rem)" }}
            >
              {children}
            </h2>
          );
        },
        h3({ children, ...props }) {
          return (
            <h3
              id={children?.toString()}
              {...props}
              className={`${props.className || ""} text-xl font-bold mt-4`.trim()}
              style={{ ...props.style, scrollMarginTop: "var(--header-scroll-offset, 7rem)" }}
            >
              {children}
            </h3>
          );
        },
        h4({ children, ...props }) {
          return (
            <h4
              id={children?.toString()}
              {...props}
              className={`${props.className || ""} text-lg font-bold mt-4`.trim()}
              style={{ ...props.style, scrollMarginTop: "var(--header-scroll-offset, 7rem)" }}
            >
              {children}
            </h4>
          );
        },
        h5({ children, ...props }) {
          return (
            <h5
              id={children?.toString()}
              {...props}
              className={`${props.className || ""} text-base font-bold mt-4`.trim()}
              style={{ ...props.style, scrollMarginTop: "var(--header-scroll-offset, 7rem)" }}
            >
              {children}
            </h5>
          );
        },
        h6({ children, ...props }) {
          return (
            <h6
              id={children?.toString()}
              {...props}
              className={`${props.className || ""} text-sm font-bold mt-4`.trim()}
              style={{ ...props.style, scrollMarginTop: "var(--header-scroll-offset, 7rem)" }}
            >
              {children}
            </h6>
          );
        },
        p({ children, node, ...props }) {
          return (
            <p className="mt-2 py-1" {...props}>
              {children}
            </p>
          );
        },
        hr({ children, ...props }) {
          return <hr className="my-4" {...props} />;
        },
        table: ({ node, ...props }) => <table className="table" {...props} />,
        th: ({ node, ...props }) => (
          <th className="px-4 py-2 border bg-gray-600" {...props} />
        ),
        td: ({ node, ...props }) => (
          <td className="px-4 py-2 border" {...props} />
        ),
        sup: ({ children, ...props }) => (
          <sup className="text-xs mr-[4px]" {...props}>
            {children}
          </sup>
        ),
        sub: ({ children, ...props }) => (
          <sub className="text-xs mr-[4px]" {...props}>
            {children}
          </sub>
        ),
        section({ children, ...props }) {
          if (props.hasOwnProperty("data-footnotes")) {
            props.className = `${props.className || ""} mt-8`.trim();
          }
          const modifiedChildren = React.Children.map(children, (child) => {
            if (isValidElement(child) && child.props.node.tagName === "ol") {
              return cloneElement(child, {
                ...child.props,
                className: "list-decimal px-10 text-sm text-[#6B7280]",
              } as React.HTMLAttributes<HTMLParagraphElement>);
            }
            return child;
          });
          return <section {...props}>{modifiedChildren}</section>;
        },
        div({ children, node, ...props }) {
          return <div {...props}>{children}</div>;
        },
        iframe({ node, ...props }) {
          let src = typeof props.src === "string" ? props.src : undefined;
          // Bilibili player: default to no autoplay unless the embed says otherwise.
          if (src && /player\.bilibili\.com/.test(src) && !/[?&]autoplay=/.test(src)) {
            src = `${src}${src.includes("?") ? "&" : "?"}autoplay=0`;
          }
          const inlineStyle = props.style as React.CSSProperties | undefined;
          const hasExplicitHeight =
            props.height != null || Boolean(inlineStyle?.height) || Boolean(inlineStyle?.aspectRatio);
          return (
            <iframe
              {...props}
              src={src}
              className={`max-w-full ${props.className || ""}`.trim()}
              style={
                hasExplicitHeight
                  ? { maxWidth: "100%", ...inlineStyle }
                  : { width: "100%", aspectRatio: "16 / 9", border: 0, ...inlineStyle }
              }
            />
          );
        },
        video({ node, ...props }) {
          const width = props.width != null ? Number(props.width) : undefined;
          const height = props.height != null ? Number(props.height) : undefined;
          return (
            <LazyVideo
              src={typeof props.src === "string" ? props.src : undefined}
              poster={typeof props.poster === "string" ? props.poster : undefined}
              width={Number.isFinite(width) ? width : undefined}
              height={Number.isFinite(height) ? height : undefined}
              style={props.style as React.CSSProperties | undefined}
            />
          );
        },
      }}
    />), [content, colorMode, show])



  return (
    <>
      {Content}
      <ImageLightbox
        plugins={[Download, Zoom, Counter]}
        index={index}
        slides={lightboxSlides}
        open={index >= 0}
        close={() => setIndex(-1)}
      />
    </>
  );
}
