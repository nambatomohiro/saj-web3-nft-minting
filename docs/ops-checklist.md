# 運営チェックリスト（主催者用ランブック）

> web3ビジネス研究会 第2回（2026-09-18）NFT発行ハンズオンの運営タスク。
> 設計の背景は [設計書](superpowers/specs/2026-07-07-saj-web3-nft-minting-handson-design.md) を参照。
> 開発作業（§4/§5/§7/§9/§10）は 2026-07-08 に完了・検証済み。残るのは本書のタスクのみ。
> 実演デモの通し記録は [rehearsal-2026-07-13](rehearsal-2026-07-13.md)（Part3+Part4フル成功・要修正なし）。

---

## 1. 事前（〜開催1週間前）

- [ ] **アドレス提出チャンネルを用意**（Slack / Discord の両方に作成。参加者は両方に参加済みなので招待の案内は不要）
  - 提出してもらうのは**ウォレットアドレスのみ**（`0x...`）。秘密鍵は絶対に聞かない
  - チャンネルのトピックに「セミナー専用ウォレットを用意すること」を明記（README「事前準備6」参照）
  - **投稿は「氏名 アドレス」の1行形式で依頼する**（案内文もそうなっている）。氏名を別行にすると
    `parseRecipients` が氏名行を「アドレスが見つかりません」として skipped に載せるため、
    本当の不備が埋もれる。1行なら前後に日本語が混じっても素通しで拾える
- [ ] **参加者への事前案内を送付**
  - メール文面は [pre-event-email.md](pre-event-email.md) をそのまま使用。`【要差し替え】`（提出チャンネル名・提出期限・質問用チャンネル名・差出人名）を埋めてから送る
  - リポジトリURL: https://github.com/nambatomohiro/saj-web3-nft-minting （READMEが手順書。事前準備は本メールと同一内容）
  - 「`docker compose pull` まで前日までに済ませる」ことを強調（当日wifiに賭けない）
- [ ] **質問窓口を用意**（Discord / Slack 等）— 事前準備のつまずき対応

## 2. POLを貯める（イベント2〜3週間前から毎日）

> **⚠️ 公式faucetは廃止されました。** `faucet.polygon.technology` は停止済みで、Polygon公式ドキュメントも
> [third-party faucetを使うよう案内](https://docs.polygon.technology/tools/gas/matic-faucet/)しています。以下は差し替え後の運用。

### 2-1. なぜ「請求用」と「貯蔵用」を分けるのか（重要）

現行faucetには**貯蔵ウォレットで直接請求できない**理由が2つあります。

1. レート制限が**受け取りアドレス単位/24h**。→ 複数人が同じ貯蔵アドレスを宛先に指定しても、2人目以降は弾かれる
2. **テストネット残高が多いアドレスは請求資格を失う**（Alchemyの明示ルール）。→ 貯まるほど請求できなくなる

したがって唯一回る運用は次の形です。

```
協力者A: 請求用ウォレットA --(faucet請求)--> sweep --> ┐
協力者B: 請求用ウォレットB --(faucet請求)--> sweep --> ├--> 貯蔵ウォレット --> distribute --> 参加者
協力者C: 請求用ウォレットC --(faucet請求)--> sweep --> ┘
```

**受け取り側に回数制限は無い**ので、何人からでも何回でも同じ貯蔵ウォレットに集約できます。
請求したらすぐ sweep して請求用ウォレットを空に保つことが、翌日の請求資格を維持するコツです。

### 2-2. 現行faucetと資格要件

| faucet | 配布量 | 制限 | 資格要件 |
|---|---|---|---|
| [Alchemy](https://www.alchemy.com/faucets/polygon-amoy) | 0.1〜0.5 POL/日（アカウント有で増額） | アドレス単位/24h | **ETHメインネットに 0.001 ETH 以上＋取引履歴** |
| [QuickNode](https://faucet.quicknode.com/polygon/amoy) | 少量（ツイートで2倍） | アカウント単位/12h | ウォレット接続 |
| [Chainstack](https://faucet.chainstack.com/amoy-faucet) | 0.01 POL | 24h | 0.08 ETH 以上（実質使えない） |

> **ボトルネックはウォレット数ではなく「メインネットETHの実績を持つ協力者の人数」です。** 声をかける相手はここで決まります。
> 配布量は変動するので、運用開始日に実測して本書を更新すること。

### 2-3. セットアップ（協力者それぞれ・1回だけ）

- [ ] 請求用ウォレットを新規作成（**貯蔵ウォレットとは別アドレス**にすること）
- [ ] `.env` に自分の請求用ウォレットの鍵と、共通の貯蔵アドレスを設定

  ```bash
  SEMINAR_PRIVATE_KEY=<請求用ウォレットの秘密鍵>
  TREASURY_ADDRESS=0x9f289dce99B33fa168211cC0BD382663c493c9c2   # 貯蔵=実演台=配布原資
  ```

### 2-4. 日次ルーチン（協力者それぞれ・1日1回）

- [ ] faucetで請求用ウォレットへ請求（§2-2の表から。複数faucetを併用してよい）
- [ ] 貯蔵ウォレットへ転送:

  ```bash
  docker compose exec hardhat npm run sweep:amoy              # ドライラン（金額確認）
  docker compose exec hardhat npm run sweep:amoy -- --execute # 実送金
  ```

  ガス代の上限（21000ガス×3倍マージン）だけ残して全額送ります。残高が手数料に満たない日は
  「送金できる残高がありません」と表示して**エラーにならず正常終了**するので、毎日同じコマンドで回せます。

### 2-5. 進捗確認（主催者・随時）

```bash
docker compose exec hardhat npm run funding-status:amoy
```

貯蔵ウォレットの残高・必要額・達成率・「あと何POL」を表示します。
必要額は `0.1 POL × 人数 + 実演予備 0.15 POL`（配布ツールと同じ定数を共有しているので判定がズレません）。
人数は `distribute/recipients.txt` があればその提出件数、無ければ想定30人で計算します。

**必要量の目安**: 参加者30人なら **3.15 POL**。協力者1人が0.2 POL/日で約16日、**3人体制なら約6日**で到達します。
イベント2〜3週間前に始めれば十分な余裕があります。

## 3. POL配布（アドレス提出の締切後）

- [ ] 提出された各アドレスへ **0.1 POL** を送付
  - **根拠（実測）**: deploy → mint → check → burn の全工程で **0.044 POL**（オプティマイザ有効・30 gwei時）。0.1 POLで2倍以上の余裕
  - 原資は §2 で貯めた貯蔵ウォレット（＝実演台ウォレット）。`npm run funding-status:amoy` が「到達」を出してから実行する
  - **一括配布ツールあり**（`tasks/distribute.js`。設計: [spec](superpowers/specs/2026-07-13-amoy-pol-distribution-design.md)）:
    1. Slack/Discord の提出アドレスを `distribute/recipients.txt` に1行1件で貼る（前後に日本語が混じってもOK。`distribute/` はgit管理外）
    2. ドライランで件数・総額・原資充足を確認: `docker compose exec hardhat npm run distribute:amoy -- distribute/recipients.txt`
    3. 問題なければ実送金: 末尾に `--execute` を付けて再実行
    - 冪等（残高0.1 POL以上はスキップ・失敗は再実行で未達分だけ再送）。原資が足りなければ送金前に停止する

## 4. 直前（前日〜当日朝）

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
  - **⚠️ 2026-07-13 の実演リハで残高がほぼ枯渇**（1通しで −0.048 POL → 現在 **0.008 POL**。[記録](rehearsal-2026-07-13.md)）。このままでは1通しも回せない
  - 当日リハ＋本番の2回分として **0.15 POL程度まで補充**しておく（deploy 2回分の余裕。deploy が約0.041 POLで支配的、mint+burnは約0.007 POL）
  - この0.15 POLは §2 の貯蔵ウォレット＝実演台ウォレットなので、**§2で貯めて §3で配布した後の残り**がそのまま実演予備になる（`distribute` が0.15 POLを必ず残す設計）。`npm run funding-status:amoy` で残額を確認すること

## 5. 当日

- [ ] 開演前: 実演台で `docker compose up -d` → `docker compose exec hardhat npm run deploy` まで済ませて動作確認（本番では参加者と一緒に打ち直す）
- [ ] タイムラインと降格判断（時間が押したら層3から実演のみに切替）は設計書§8のとおり
- [ ] Part1冒頭で**必ず明言**: 「今日作るのは練習台。本物の会員証は将来 Base に Soulbound で発行する」（設計書§1の★前提）

## 6. 変更時の運用ルール（開発を再開する場合）

| 変更対象 | 必要な作業 |
|---|---|
| `contracts/` `tasks/` `test/` `hardhat.config.js` README | git push のみでOK（ソースはコンテナにマウントされるため） |
| `package.json` / `package-lock.json`（依存変更） | **イメージ再ビルド＆push必須**: `docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/nambatomohiro/saj-nft:latest --push .`（要 `docker login ghcr.io`、PATは `write:packages`） |
| `Dockerfile` | 同上（再push必須） |

## 7. 参考リンク

- 配布イメージ: https://github.com/nambatomohiro/saj-web3-nft-minting/pkgs/container/saj-nft （public）
- 実演リハの通し記録: [rehearsal-2026-07-13](rehearsal-2026-07-13.md)
- リハーサルの公開記録（参加者に見せる例としても使える。最新=2026-07-13）:
  - コントラクト: https://amoy.polygonscan.com/address/0x9bd8012439C13FD15004e5B2D9D79c43b719B7f3
  - mint: https://amoy.polygonscan.com/tx/0xe627ca812f0125af7d3cdad8369e07fffd461bab57581d2cdaf050c439f83ffd
  - burn: https://amoy.polygonscan.com/tx/0x1e83cdfb29de1bbca5e439b414171e4df8c1b08e7880cc5b228c2bbea5d7584d
