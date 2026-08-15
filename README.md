# SAJ Web3 NFT発行ハンズオン

web3ビジネス研究会 第2回イベント（2026-09-18）のハンズオン教材です。
NFT（会員証の**練習台**）を自分の手で **発行 → 会員判定 → 譲渡 → 焼却** します。

> ⚠️ **ここで作るのは「練習台」です。** 本物の会員証ではありません。
> 練習台はあえて「譲渡できる」仕様です — 会員証が売れてしまったら困りますよね？
> だから本物の会員証は、将来 Base メインネットに **Soulbound（譲渡不可）** で発行します。
> その「なぜ」を体験するのがこのハンズオンです。

## 参加スタイル（どれでもOK）

| スタイル | 必要なもの |
|---|---|
| **見るだけ** | なし。主催者の実演をスクリーンで見て理解する |
| **追随（ハンズオン）** | Docker が動くPC と MetaMask（セミナー専用ウォレット）。下の事前準備を済ませて、当日同じコマンドを叩く |

---

## 事前準備（イベント前日までに）

上から順に実行してください。参加者向けの案内メール文面は [pre-event-email.md](docs/pre-event-email.md) にあります（内容は本節と同一）。

### 1. ターミナル（コマンドライン）を開く

以降の作業はすべてターミナルで行います。

| OS | 開き方 |
|---|---|
| **Windows** | スタートボタン →「PowerShell」と入力 →「Windows PowerShell」を開く |
| **Mac** | `Command + スペース` →「ターミナル」と入力 → Enter |

行頭または行末に `>` `%` `$` のいずれかが出ていればOK。これは「入力待ち」の印で、記号自体は打ち込みません。以降「実行」と書いてあるものは、コマンドを貼り付けて Enter を押すという意味です。

### 2. Git をインストール

教材の取得に使います。

- **Windows**: [git-scm.com/download/win](https://git-scm.com/download/win) からインストーラを取得し、設定はすべて既定のまま「Next」で進めます。
  > インストール後、**PowerShell を一度閉じて開き直してください**。開いたままだと Git を認識しません。
- **Mac**: 下の確認コマンドを実行すると「コマンドラインデベロッパツールが必要です」というダイアログが出るので、「インストール」を押して完了を待ちます。出ない場合は [git-scm.com/download/mac](https://git-scm.com/download/mac)。

```bash
git --version   # → git version 2.39.0 のように表示されれば成功
```

### 3. Docker Desktop をインストール

教材の実行環境です。依存はイメージに焼き込み済みなので、当日その場でのインストール作業は発生しません。

[Docker Desktop](https://www.docker.com/products/docker-desktop/)

- **Windows**: 「Download for Windows」から取得。WSL2 に関する項目はチェックを入れたまま進めます。インストール後、**PCの再起動が必要**です。
- **Mac**: Apple Silicon 版と Intel 版があります。リンゴマーク →「このMacについて」で、「チップ」に Apple M... とあれば Apple Silicon、「プロセッサ」に Intel とあれば Intel 版。
- 社用PCなどで Docker Desktop が使えない場合は Podman Desktop や WSL2 上の Docker でも可

インストール後は Docker Desktop を起動し、**クジラのアイコンが「Running」（緑）になるまで待ちます**。ここが Running でないと以降のコマンドはすべて失敗します。

```bash
# ターミナルを開き直してから実行
docker --version
docker compose version   # → 両方バージョンが表示されれば成功
```

### 4. 教材を取得し、プロジェクトフォルダへ移動

ターミナルには「いまどのフォルダで作業しているか」という現在地（**カレントディレクトリ**）があります。手順5以降のコマンドはすべてプロジェクトフォルダの中で実行します。現在地が違うと、同じコマンドでもエラーになります。

```bash
# (1) 置き場所へ移動（ホームフォルダ直下。確実に存在し、迷子になりにくい）
cd $HOME

# (2) 取得して、そのフォルダの中へ入る
git clone https://github.com/nambatomohiro/saj-web3-nft-minting.git
cd saj-web3-nft-minting

# (3) 現在地を確認
pwd   # → 末尾が saj-web3-nft-minting になっていればOK
```

> ★**ここが最重要ポイント**
> - これ以降のコマンドは、すべてこのフォルダの中で実行します。
> - ターミナルを閉じて開き直すと現在地は元に戻ります。次回は `cd $HOME` → `cd saj-web3-nft-minting` で戻れます。
> - うまくいかないときは、まず `pwd` で現在地を確認。

```bash
# (4) 実行に必要なデータを事前ダウンロード（数分〜十数分かかることがあります）
docker compose pull   # 会場のwifiに頼らないよう、必ず事前に!
```

### 5. 起動確認

プロジェクトフォルダにいることを確認してから実行します。

```bash
docker compose up
```

`Started HTTP and WebSocket JSON-RPC server at http://0.0.0.0:8545/` とテスト用アカウント20個が表示されれば成功です。確認できたら `Control + C` で停止します（Mac も Command ではなく Control キー）。

### 6. ウォレットの準備と秘密鍵の設定

当日は公開テストネット（Polygon Amoy）にも記録するため、ハンズオンに追随する方は全員この準備が必要です。

**(1) [MetaMask](https://metamask.io/) をインストール**

**(2) セミナー専用ウォレットを用意する**

> ★ 普段使いのウォレット・秘密鍵は**絶対に使わない**でください。練習では秘密鍵をファイルに書くため、使い捨て前提のウォレットを使います。

- **MetaMask を初めて入れる方**: インストール後の案内どおり「新しいウォレットを作成」すれば、それがそのままセミナー専用ウォレットになります。追加の作業は不要です。
- **すでに資産の入った MetaMask をお使いの方**:
  - *推奨* — ブラウザで新しいプロファイルを作り、そちらに MetaMask を入れて新規ウォレットを作成（普段使いと完全に分離できます）
  - *最低ライン* — いまの MetaMask で「アカウントを追加」し、セミナー専用アカウントを1つ作成。以降の提出・設定には必ずその新しいアカウントのアドレスと秘密鍵を使います

> ★ どちらの場合も、**シークレットリカバリーフレーズ（12単語）は絶対に開かない・コピーしない・誰にも見せない**でください。ファイルに書くのは「アカウント1つ分の秘密鍵」だけです。秘密鍵が漏れても被害はそのアカウント1つですが、リカバリーフレーズが漏れるとウォレットの全アカウントが失われます。

**(3) アドレスをコピーして提出**

ウォレットができたら、そのまま続けてアドレスを提出します（主催者がテスト用POLを配布します）。

1. MetaMask 画面上部のアドレス（`0x...`）をクリックするとコピーされます（バージョンによってはアカウントのメニュー →「アカウントの詳細」に表示）
2. Slack / Discord の提出チャンネルに、**氏名とアドレスを1行にまとめて**投稿

   ```
   山田太郎 0x1234567890abcdef1234567890abcdef12345678
   ```

> 投稿するのは**アドレスのみ**。アドレスは公開情報なのでチャンネルに貼って問題ありませんが、**秘密鍵とシークレットリカバリーフレーズは絶対に投稿しない**こと（主催者も聞きません）

**(4) `.env` に秘密鍵を設定**

プロジェクトフォルダにいることを確認してから実行します。

```bash
cp .env.example .env
```

作成した `.env` をエディタで開きます。`.env` は隠しファイルなので、エクスプローラーや Finder には表示されません。

```bash
notepad .env    # Windows
open -e .env    # Mac
```

MetaMask の「アカウントの詳細 → 秘密鍵」（表記はバージョンにより異なります）からコピーした秘密鍵を記入:

```
SEMINAR_PRIVATE_KEY=0xあなたのセミナー専用ウォレットの秘密鍵
```

`.env` は git 管理外（.gitignore 済み）なので、コミットされる心配はありません。

---

## 当日 Part3: ローカルチェーンで発行体験（メイン）

まず自分のPCの中だけで動くブロックチェーンを起動します。ガス代不要・失敗しても何度でもやり直せます。

```bash
docker compose up -d        # ローカルチェーン起動(バックグラウンド)
docker compose logs -f      # チェーンのログを見たいとき(Ctrl+Cで抜ける)
```

### コマンド一覧

```bash
# ① コントラクト(NFTの発行機)をデプロイ
docker compose exec hardhat npm run deploy

# ② 自分に会員証(練習台)を1枚発行
docker compose exec hardhat npm run mint -- あなたの名前

# ③ 会員判定(token-gating): 保有者だけが会員
docker compose exec hardhat npm run check-membership -- <アドレス>

# ④ 譲渡: 会員証が"送れてしまう"体験
docker compose exec hardhat npm run transfer -- <送り先アドレス>
```

> 💡 `--` は「ここから先が引数」という npm の区切り記号です。忘れるとエラーになります。

### やってみる（コピペ用）

ローカルチェーンには練習用アカウントが20個あります。自分＝アカウント#0、「隣の人」役＝アカウント#1 に見立てます。

```bash
docker compose exec hardhat npm run deploy
docker compose exec hardhat npm run mint -- 難波
docker compose exec hardhat npm run check-membership -- 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
# → ✅ YES — 会員です(保有数: 1)

docker compose exec hardhat npm run check-membership -- 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
# → ❌ NO — 会員証を保有していません

docker compose exec hardhat npm run transfer -- 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
# → ✅ 譲渡完了 — 会員証が他人に渡ってしまいました(だから本物は Soulbound にします)

docker compose exec hardhat npm run check-membership -- 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
# → ❌ NO — もう会員ではない!
```

---

## 当日 Part4: Amoy（公開テストネット）に刻む

同じコマンドの `:amoy` 版を使うだけで、宛先が Polygon の公開テストネット Amoy に切り替わります。今度は**世界中の誰からも見える**チェーンに刻まれます（`.env` の設定が必要です）。

```bash
docker compose exec hardhat npm run deploy:amoy
docker compose exec hardhat npm run mint:amoy -- あなたの名前
docker compose exec hardhat npm run check-membership:amoy -- <あなたのアドレス>
```

実行すると [amoy.polygonscan.com](https://amoy.polygonscan.com) のリンクが表示されます。開くと、自分のトランザクションが公開台帳に載っているのが見えます。

### 焼却儀式 🔥

締めに、Amoy上の練習会員証を自分の手で焼却します。

```bash
docker compose exec hardhat npm run burn:amoy
# → ✅ 焼却完了 — 練習台はここでおしまい。本物の会員証は将来 Base に。
```

---

## MetaMask で見る（任意）

### ローカルチェーンを見る

1. MetaMask → ネットワークを追加（手動）
   - ネットワーク名: `Hardhat Local` / RPC URL: `http://localhost:8545` / チェーンID: `31337` / 通貨: `ETH`
2. 練習用アカウント#0 をインポート（アカウント → 秘密鍵でインポート）:
   `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
   > ⚠️ この鍵は**全世界に公開されている練習用の鍵**です。本物の資産を絶対に送らないでください
3. NFTタブ → NFTをインポート → deploy時に表示されたコントラクトアドレスと tokenId を入力

### Amoy を見る

- ネットワーク名: `Polygon Amoy` / RPC URL: `https://rpc-amoy.polygon.technology` / チェーンID: `80002` / 通貨: `POL` / エクスプローラ: `https://amoy.polygonscan.com`

---

## しくみ

```
┌─ あなたのPC ─────────────────────────────┐
│  ┌─ Dockerコンテナ ──────────────────┐   │
│  │  Hardhat node(ローカルチェーン)    │◄──┼── MetaMask (localhost:8545)
│  │  + npm run deploy/mint/... 実行環境 │   │
│  └───────────────────────────────────┘   │
└───────────────────────────────────────────┘
                    │ npm run *:amoy のときだけ
                    ▼
         Polygon Amoy(公開テストネット)
```

| ファイル | 役割 |
|---|---|
| `contracts/SAJMemberNFT.sol` | 会員証NFT本体（ERC-721。譲渡可＋焼却可の練習台） |
| `tasks/handson.js` | deploy / mint / check-membership / transfer / burn の中身 |
| `test/SAJMemberNFT.js` | コントラクトのテスト（`docker compose exec hardhat npm test`） |
| `Dockerfile` / `docker-compose.yml` | 実行環境。依存はイメージに焼き込み済み＝当日のインストール待ちなし |

メタデータ（`{"name":"SAJ Web3 Member","member":"<名前>","year":"2026"}`）はブロックチェーン上に直接記録され、画像やサーバーに依存しません。

---

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| `Cannot connect to the Docker daemon` | Docker Desktop を起動してください |
| `port is already allocated`（8545） | 8545番ポートを使う他のアプリを終了、または前回のコンテナを `docker compose down` |
| `デプロイ記録が見つかりません` | 先に `npm run deploy`（Amoyなら `deploy:amoy`）を実行 |
| `署名用アカウントがありません`（Amoy） | `.env` に `SEMINAR_PRIVATE_KEY` を設定（事前準備の6） |
| Amoyでガス代エラー | テスト用POLが不足。主催者に声かけを |
| 最初からやり直したい | `docker compose down` → `docker compose up -d`（ローカルチェーンは毎回まっさらに戻ります） |

## 片付け

```bash
docker compose down
```

ローカルチェーンとその上のNFTは消えます — 練習台はそれでおしまい。本物は将来、Base に。

---

## 開発者向けメモ

- テスト: `docker compose exec hardhat npm test`
- イメージを自前ビルド: `docker compose build`（公開イメージを使わない場合）
- 設計書: [docs/superpowers/specs/2026-07-07-saj-web3-nft-minting-handson-design.md](docs/superpowers/specs/2026-07-07-saj-web3-nft-minting-handson-design.md)
