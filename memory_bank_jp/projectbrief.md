# PDFme プロジェクト概要

PDFme は、PDF の設計と生成プロセスを簡素化するために設計された TypeScript ベースのライブラリです。複数の npm パッケージとして配布され、ブラウザと Node.js 環境の両方で動作します。

## 主な目的

-   簡単なコードでデザインされた PDF を作成する
-   PDF エディタ機能をアプリケーションに統合する
-   パフォーマンスを損なうことなく大量の PDF を作成する

## 技術スタック

-   TypeScript: すべてのコードベース
-   React: UI コンポーネント
-   pdf-lib (フォーク版): PDF 生成エンジン
-   その他: fontkit, PDF.js, antd, react-moveable, react-selecto, dnd-kit

## リポジトリ構造

-   **packages/**: メインライブラリ
    -   **@pdfme/generator, @pdfme/schemas, @pdfme/ui**: PDF 生成とテンプレート設計
    -   **@pdfme/manipulator, @pdfme/converter**: PDF 操作ユーティリティ
    -   **@pdfme/common**: 共通ロジックと型定義
-   **website/**: 公式ドキュメント (Docusaurus)
-   **playground/**: 開発テスト用の React SPA

## ライセンスと貢献

-   MIT ライセンスに基づくオープンソース
-   コミュニティ開発と貢献を歓迎します 