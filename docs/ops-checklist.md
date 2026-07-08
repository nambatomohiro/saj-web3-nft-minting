# 運営チェックリスト（主催者用ランブック）

> web3ビジネス研究会 第2回（2026-09-18）NFT発行ハンズオンの運営タスク。
> 設計の背景は [設計書](superpowers/specs/2026-07-07-saj-web3-nft-minting-handson-design.md) を参照。
> 開発作業（§4/§5/§7/§9/§10）は 2026-07-08 に完了・検証済み。残るのは本書のタスクのみ。

---

## 1. 事前（〜開催1週間前）

- [ ] **アドレス提出フォームを作成**（Googleフォーム等）
  - 提出してもらうのは**ウォレットアドレスのみ**（`0x...`）。秘密鍵は絶対に聞かない
  - フォーム文面に「セミナー専用ウォレットを新規作成すること」を明記（README「事前準備4」参照）
- [ ] **参加者への事前案内を送付**
  - リポジトリURL: https://github.com/nambatomohiro/saj-web3-nft-minting （READMEが手順書）
  - 「`docker compose pull` まで前日までに済ませる」ことを強調（当日wifiに賭けない）
- [ ] **質問窓口を用意**（Discord / Slack 等）— 事前準備のつまずき対応

## 2. POL配布（フォーム締切後）

- [ ] 提出された各アドレスへ **0.1 POL** を送付
  - **根拠（実測）**: deploy → mint → check → burn の全工程で **0.044 POL**（オプティマイザ有効・30 gwei時）。0.1 POLで2倍以上の余裕
  - 配布元POLは [faucet.polygon.technology](https://faucet.polygon.technology/) で日次取得、不足分は他のfaucet（Alchemy / QuickNode）も併用
  - アドレスリストが揃ったら一括送付スクリプトを作れる（Claude Codeに依頼すればすぐ）

## 3. 直前（前日〜当日朝）

- [ ] **イメージのタグ固定**（直前の変更事故防止）:

  ```bash
  # 既存のマルチアーキイメージにタグを追加(再ビルド不要)
  docker buildx imagetools create \
    -t ghcr.io/nambatomohiro/saj-nft:seminar-20260918 \
    ghcr.io/nambatomohiro/saj-nft:latest
  ```

  その後 `docker-compose.yml` の `image:` を `:seminar-20260918` に変更してコミット＆push。
  以降イベントまで main に触らない

- [ ] **実演台で通しリハーサル**（背骨の担保・設計書§2）:
  1. まっさらな状態を再現: `docker compose down` → イメージ削除 → `git clone` からやり直し
  2. README の手順を上から下まで実行（Part3 → Part4）
  3. プロジェクター接続でターミナルのフォントサイズ確認

- [ ] **実演用ウォレットの残高確認**
  - リハーサル済みウォレット `0x9f289dce99B33fa168211cC0BD382663c493c9c2` が実演台の `.env` に設定済み（このリポジトリの `.env`。git管理外なのでマシンを変える場合は手動で持っていく）
  - 2026-07-08 時点の残高 0.056 POL → 当日分として **0.15 POL程度まで補充**しておく（deploy 2回分の余裕）

## 4. 当日

- [ ] 開演前: 実演台で `docker compose up -d` → `docker compose exec hardhat npm run deploy` まで済ませて動作確認（本番では参加者と一緒に打ち直す）
- [ ] タイムラインと降格判断（時間が押したら層3から実演のみに切替）は設計書§8のとおり
- [ ] Part1冒頭で**必ず明言**: 「今日作るのは練習台。本物の会員証は将来 Base に Soulbound で発行する」（設計書§1の★前提）

## 5. 変更時の運用ルール（開発を再開する場合）

| 変更対象 | 必要な作業 |
|---|---|
| `contracts/` `tasks/` `test/` `hardhat.config.js` README | git push のみでOK（ソースはコンテナにマウントされるため） |
| `package.json` / `package-lock.json`（依存変更） | **イメージ再ビルド＆push必須**: `docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/nambatomohiro/saj-nft:latest --push .`（要 `docker login ghcr.io`、PATは `write:packages`） |
| `Dockerfile` | 同上（再push必須） |

## 6. 参考リンク

- 配布イメージ: https://github.com/nambatomohiro/saj-web3-nft-minting/pkgs/container/saj-nft （public）
- リハーサルの公開記録（参加者に見せる例としても使える）:
  - コントラクト: https://amoy.polygonscan.com/address/0x54e62C6042234A8AfE7B37353d485e89A836feb1
  - mint: https://amoy.polygonscan.com/tx/0x521eb4464f14dd77b1e8d8843adf8822f857de407faa34140f62a1f4fd82d494
  - burn: https://amoy.polygonscan.com/tx/0x5eeb0ce041ac990ae02a53fc94ac07bf082dab30becac807bfa02671cc5f8b0f
