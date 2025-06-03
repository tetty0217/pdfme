# PDFme 技術コンテキスト

## 使用技術

-   **言語**: TypeScript
-   **フレームワーク**: React (UI コンポーネント)
-   **ビルドツール**: npm スクリプト, webpack
-   **テスト**: Jest
-   **ドキュメンテーション**: Docusaurus
-   **依存ライブラリ**:
    -   pdf-lib (フォーク版): PDF 生成
    -   fontkit: フォントレンダリング
    -   PDF.js: PDF 表示
    -   antd: UI コンポーネント
    -   react-moveable, react-selecto: デザイナー UI
    -   dnd-kit: ドラッグアンドドロップ機能

## 開発セットアップ

1.  リポジトリをクローンする
2.  `npm install` で依存関係をインストールする
3.  `npm run build` でパッケージをビルドする
4.  `npm run test` でテストを実行する
5.  各パッケージで `npm run dev` を実行して開発モードを開始する
6.  playground で変更をテストする: `cd playground && npm install && npm run dev`

## 技術的制約

-   Node.js 16 以上が必要
-   ブラウザと Node.js 環境の両方で動作する必要がある
-   最小限の依存関係を維持する
-   パフォーマンスを優先する
-   後方互換性を維持する

## 依存関係管理

-   新しい依存関係の追加は慎重に検討する
-   共通機能は @pdfme/common に集約する
-   各パッケージは明確に分離された責務を持つ 