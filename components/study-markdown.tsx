'use client';
import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    StudyModeViewer?: {
      renderMarkdown: (node: HTMLElement, value: string) => void;
    };
  }
}
let loader: Promise<void> | undefined;
function loadRenderer() {
  if (loader) return loader;
  loader = (async () => {
    if (!document.querySelector('link[data-study-katex]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/study-ui/vendor/katex/katex.min.css';
      link.dataset.studyKatex = 'true';
      document.head.appendChild(link);
    }
    for (const path of [
      'vendor/markdown-it/markdown-it.min.js',
      'vendor/katex/katex.min.js',
      'vendor/dompurify/purify.min.js',
      'markdown.js',
    ]) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/study-ui/' + path;
        script.onload = () => resolve();
        script.onerror = () => {
          script.remove();
          reject(new Error('公式排版资源加载失败'));
        };
        document.head.appendChild(script);
      });
    }
  })().catch((error) => {
    loader = undefined;
    throw error;
  });
  return loader;
}
export default function StudyMarkdown({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    void loadRenderer()
      .then(() => {
        if (active && ref.current)
          window.StudyModeViewer?.renderMarkdown(ref.current, text);
      })
      .catch(() => {
        if (active && ref.current) ref.current.textContent = text;
      });
    return () => {
      active = false;
    };
  }, [text]);
  return (
    <div ref={ref} className={`markdown-body ${className}`}>
      {text}
    </div>
  );
}
