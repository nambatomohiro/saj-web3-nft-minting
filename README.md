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
| **追随（ハンズオン）** | Docker が動くPC。下の事前準備を済ませて、当日同じコマンドを叩く |
| **＋ MetaMask**（任意） | 発行したNFTを見慣れたウォレットUIで見たい人だけ |

---

## 事前準備（イベント前日までに）

### 1. Docker Desktop をインストール

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)（Mac / Windows）
- 社用PCなどで Docker Desktop が使えない場合は Podman Desktop や WSL2 上の Docker でも可

### 2. リポジトリ取得とイメージの事前ダウンロード

```bash
git clone https://github.com/nambatomohiro/saj-web3-nft-minting.git
cd saj-web3-nft-minting
docker compose pull   # 会場のwifiに頼らないよう、必ず事前に!
```

### 3. 起動確認

```bash
docker compose up
```

`Started HTTP and WebSocket JSON-RPC server at http://0.0.0.0:8545/` とテスト用アカウント20個が表示されれば成功です。`Ctrl+C` で止められます。

### 4. （Part4「Amoy」まで追随する人のみ）ウォレットの準備

1. [MetaMask](https://metamask.io/) をインストール
2. **セミナー専用ウォレットを新規作成**する
   > ★ 普段使いのウォレット・秘密鍵は**絶対に使わない**でください。練習では秘密鍵をファイルに書くため、専用の使い捨てウォレットを使います。
3. ウォレットの**アドレス**（`0x...`）を事前フォームで提出（主催者がテスト用POLを配布します）
   > 提出するのはアドレスのみ。**秘密鍵は誰にも渡さない**こと（主催者も聞きません）
4. `.env` を作成して秘密鍵を設定:

```bash
cp .env.example .env
```

`.env` をエディタで開き、MetaMask（アカウント詳細 → 秘密鍵のエクスポート）からコピーした秘密鍵を記入:

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
| `署名用アカウントがありません`（Amoy） | `.env` に `SEMINAR_PRIVATE_KEY` を設定（事前準備の4） |
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
