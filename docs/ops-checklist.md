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

## 2. POLの調達（2026-08-15 完了済み）

> **✅ 本番の原資は確保済みです。** Polygon Labs の申請フォームで **100 POL** を取得しました
> （[tx](https://amoy.polygonscan.com/tx/0xc116ee88eb22aca1eb09bf8a0acf6d71f406fb05ec38001f4264f31ea2831a6b)）。
> 30人配布に必要なのは 9.5 POL なので、追加の調達作業は不要です。

### 2-1. 使ったルート：Polygon Labs の Test Token Request フォーム

**これが唯一まともに機能する調達手段です。** 足りなくなったら、まずここに出してください。

- フォーム: https://docs.google.com/forms/d/e/1FAIpQLSe4npoGldJknEs9EBtPaV3AS-0HTso2IuMWDCiMmLEMCx8euQ/viewform
- **1プロジェクトあたり90日で100 POLまで、承認不要**（超過分は却下される）
- **メインネットの残高・取引履歴の要件は一切なし。** faucetの資格審査を丸ごと回避できるのが最大の利点

記入内容（2026-08-15 実績）:

| 項目 | 記入した内容 |
|---|---|
| Requester Name and Telegram/Discord Id | 氏名 + Discord ID（**Telegramは必須ではない**。この欄自体がDiscordを許容している） |
| Project ( Telegram Group name ) | プロジェクト名 + GitHubリポジトリURL（第三者が実在を確認できるものを書くと通りやすい） |
| Token Quantity | 100 |
| Wallet Address | 受取用アドレス |
| Reason For Tokens | Testing Purposes |

### 2-2. ⚠️ 試してダメだったもの（再挑戦しないこと）

**third-party faucetは全滅でした。** 時間を溶かすので同じ道を辿り直さないでください。

| faucet | 結果（2026-08-15 実測） |
|---|---|
| [Alchemy](https://www.alchemy.com/faucets/polygon-amoy) | ❌ **メインネットの取引履歴不足**で拒否。0.001 ETH の残高条件を満たしても通らない。必要な履歴量は非公開なので深追い禁物 |
| [GetBlock](https://getblock.io/faucet/matic-amoy/) | ❌ 実エラーは「**at least 5 POL on mainnet**」（ページ記載の 0.005 ETH とは別物）。Polygonメインネットで実弾が必要 |
| [Chainstack](https://faucet.chainstack.com/amoy-faucet) | ❌ 公式の推奨リストから消滅 |

パターンとして、**third-party faucetは何らかの形でメインネットの実弾を要求します**（乱用対策）。1つずつ試す期待値は低いです。

未検証で残るもの: 公式 `faucet.polygon.technology`（公式docsは「提供終了」と書いているがページは生きており、**実際に請求が通るかは未確認**。二次情報では0.5 POL/日・アドレス単位）、[Chainlink](https://faucets.chain.link/polygon-amoy)（0.5 POL）、[QuickNode](https://faucet.quicknode.com/polygon/amoy)、[StakePool](https://faucet.stakepool.dev.br/)。

**タダで確実な代替**: Amoy の POL は無価値なテストトークンなので、**持っている人に頼めば普通に分けてくれます**。Amoyで開発している知人か、Polygon公式Discord（docsがtestnet相談先として案内している）へ。faucetを開拓するより早いです。

### 2-3. 残高の確認

```bash
docker compose exec hardhat npm run funding-status:amoy
```

貯蔵ウォレットの残高・必要額・達成率・「あと何POL」を表示します。
必要額は `0.3 POL × 人数 + 実演予備 0.5 POL`（配布ツールと同じ定数を共有しているので判定がズレません）。
人数は `distribute/recipients.txt` があればその提出件数、無ければ想定30人で計算します。

**必要量**: 参加者30人なら **9.5 POL**。

### 2-4. フォールバック：協力者で貯める運用（現在は不要）

フォーム申請が使えなくなった場合に備えて `tasks/collect.js` の `sweep` を残してあります。
faucetのレート制限は**受け取りアドレス単位/24h**なので、貯蔵アドレスを宛先に指定して複数人が請求しても2人目以降は弾かれます。
したがって唯一回る形は次のとおりです。

```
協力者A: 請求用ウォレットA --(faucet請求)--> sweep --> ┐
協力者B: 請求用ウォレットB --(faucet請求)--> sweep --> ├--> 貯蔵ウォレット --> distribute --> 参加者
協力者C: 請求用ウォレットC --(faucet請求)--> sweep --> ┘
```

**受け取り側に回数制限は無い**ので、何人からでも何回でも同じ貯蔵ウォレットに集約できます。
請求したらすぐ sweep して請求用ウォレットを空に保つのが、翌日の請求資格を維持するコツです。

協力者それぞれが、請求用ウォレットを新規作成（**貯蔵ウォレットとは別アドレス**）して `.env` を設定し、

```bash
SEMINAR_PRIVATE_KEY=<請求用ウォレットの秘密鍵>
TREASURY_ADDRESS=0x9f289dce99B33fa168211cC0BD382663c493c9c2   # 貯蔵=実演台=配布原資
```

faucet請求のあと、毎日これを打ちます。

```bash
docker compose exec hardhat npm run sweep:amoy              # ドライラン（金額確認）
docker compose exec hardhat npm run sweep:amoy -- --execute # 実送金
```

ガス代の上限（21000ガス×3倍マージン）だけ残して全額送ります。残高が手数料に満たない日は
「送金できる残高がありません」と表示して**エラーにならず正常終了**するので、毎日同じコマンドで回せます。

> ⚠️ **普段使いのウォレットの鍵を `.env` に入れないこと。** 転送は MetaMask の「最大」ボタンでも同じことができます
> （差はガス代 0.00063 POL のみ）。協力者に Docker とリポジトリを強制するより、そちらのほうが現実的です。

## 3. POL配布（アドレス提出の締切後）

- [ ] 提出された各アドレスへ **0.3 POL** を送付
  - **根拠（実測）**: deploy → mint → check → burn の全工程で 30 gwei時に **0.044 POL**。
    ただし **2026-08-15 の実測ガスは約45.5 gwei** で、同じ1周が **約0.067 POL** になる。
    旧値の 0.1 POL では**1周半しか回らず、デプロイをやり直した参加者がガス切れになる**ため 0.3 POL に引き上げた（約4周ぶん）
  - 30人でも **9 POL**。§2で100 POL確保済みなので原資を切り詰める理由はない
  - 原資は §2 の貯蔵ウォレット（＝実演台ウォレット）。`npm run funding-status:amoy` が「到達」を出してから実行する
  - **一括配布ツールあり**（`tasks/distribute.js`。設計: [spec](superpowers/specs/2026-07-13-amoy-pol-distribution-design.md)）:
    1. Slack/Discord の提出アドレスを `distribute/recipients.txt` に1行1件で貼る（前後に日本語が混じってもOK。`distribute/` はgit管理外）
    2. ドライランで件数・総額・原資充足を確認: `docker compose exec hardhat npm run distribute:amoy -- distribute/recipients.txt`
    3. 問題なければ実送金: 末尾に `--execute` を付けて再実行
    - 冪等（残高0.3 POL以上はスキップ・失敗は再実行で未達分だけ再送）。原資が足りなければ送金前に停止する

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
  - 1通しで約 −0.048 POL（30 gwei時。45.5 gwei なら約 −0.067 POL）。deploy が約0.041 POLで支配的、mint+burnは約0.007 POL
  - 実演予備は **0.5 POL**（`RESERVE_POL`。45.5 gwei で約7通しぶん）。貯蔵ウォレット＝実演台ウォレットなので、
    **§3で配布した後の残り**がそのまま実演予備になる（`distribute` が 0.5 POL を必ず残す設計）
  - `npm run funding-status:amoy` で残額を確認すること。§2で100 POL確保済みなので、配布後も90 POL以上残る見込み

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
