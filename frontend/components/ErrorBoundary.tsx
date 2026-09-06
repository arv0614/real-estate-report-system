"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** レンダー中に例外が発生した場合に代わりに表示する内容 */
  fallback: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * 子コンポーネントのレンダー中に発生した例外を捕捉し、ページ全体のクラッシュ
 * （Next.js の "This page couldn't load" 画面）を防ぐ汎用エラーバウンダリ。
 *
 * React の Error Boundary はクラスコンポーネントでしか実装できない
 * （componentDidCatch / getDerivedStateFromError はフックに存在しない）。
 *
 * 注意: 一度 hasError になると内部状態はリセットされない。再試行させたい場合は
 * 呼び出し側で `key` を変更してこのコンポーネントごと再マウントさせること。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    console.error("[ErrorBoundary] レンダー中の例外を捕捉しました:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
