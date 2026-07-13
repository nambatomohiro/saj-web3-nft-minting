# 実演リハーサル記録（2026-07-13）

> web3ビジネス研究会 第2回（本番: **2026-09-18**）NFT発行ハンズオンの実演デモを、
> 実演台の想定で **Part3（ローカル）+ Part4（Amoy）をフル**で通した記録。
> 手順書は [README](../README.md)、運営タスクは [ops-checklist](ops-checklist.md) を参照。

- **結果: 全工程成功。** 出力・ストーリー・Polygonscan記録すべて想定どおり再現できることを実地確認。
- **⚠️ 要対応: 実演台ウォレットのAmoy残高が 0.056 → 0.008 POL に減少**（1通しでほぼ枯渇）。本番前の faucet 補充は必須。

---

## 実行環境

| 項目 | 値 |
|---|---|
| 実行日 | 2026-07-13 |
| イメージ | `ghcr.io/nambatomohiro/saj-nft:latest` |
| 起動 | `docker compose up -d`（JSON-RPC 応答確認済み） |
| 実演台ウォレット（Amoy） | `0x9f289dce99B33fa168211cC0BD382663c493c9c2`（鍵は `.env` の `SEMINAR_PRIVATE_KEY`、git管理外） |

---

## Part3 — ローカルチェーンで発行体験（メイン）

ガス代ゼロ・何度でもやり直せる背骨。アカウント#0＝自分、#1＝隣の人役。

```bash
docker compose exec hardhat npm run deploy
docker compose exec hardhat npm run mint -- 難波
docker compose exec hardhat npm run check-membership -- 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266   # 自分(#0)
docker compose exec hardhat npm run check-membership -- 0x70997970C51812dc3A010C7d01b50e0d17dc79C8   # 隣(#1)
docker compose exec hardhat npm run transfer -- 0x70997970C51812dc3A010C7d01b50e0d17dc79C8           # 譲渡
docker compose exec hardhat npm run check-membership -- 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266   # 譲渡後
```

**実行結果:**

- deploy: コントラクト `0x5FbDB2315678afecb367f032d93F642f64180aa3`（deployer `0xf39F…2266` = #0）
- mint: `tokenId=0` / `member="難波"` / メタデータ `{"name":"SAJ Web3 Member","member":"難波","year":"2026"}`

**会員判定の推移（＝山場）:**

| 段階 | 自分(#0) | 隣の人(#1) |
|---|---|---|
| 発行直後 | ✅ YES（保有数 1） | ❌ NO |
| **譲渡後** | ❌ NO | ✅ YES |

→ 「会員証が他人に渡ってしまった＝だから本物は Soulbound（譲渡不可）に」という核心を、そのまま画面で見せられることを確認。

---

## Part4 — Amoy（公開テストネット）に刻む（ごほうび/締め）

`:amoy` 版で宛先が Polygon Amoy に切り替わり、世界中から見える公開台帳に刻まれる。

```bash
docker compose exec hardhat npm run deploy:amoy
docker compose exec hardhat npm run mint:amoy -- 難波
docker compose exec hardhat npm run check-membership:amoy -- 0x9f289dce99B33fa168211cC0BD382663c493c9c2
docker compose exec hardhat npm run burn:amoy
docker compose exec hardhat npm run check-membership:amoy -- 0x9f289dce99B33fa168211cC0BD382663c493c9c2   # 焼却後
```

**実行結果（全tx確定・本番で参加者に見せられる実物）:**

| 工程 | 結果 | Polygonscan |
|---|---|---|
| deploy:amoy | コントラクト `0x9bd8012439C13FD15004e5B2D9D79c43b719B7f3` | [address](https://amoy.polygonscan.com/address/0x9bd8012439C13FD15004e5B2D9D79c43b719B7f3) |
| mint:amoy | `tokenId=0` / member="難波" | [tx](https://amoy.polygonscan.com/tx/0xe627ca812f0125af7d3cdad8369e07fffd461bab57581d2cdaf050c439f83ffd) |
| check:amoy | ✅ YES（保有数 1） | — |
| burn:amoy 🔥 | 焼却完了 | [tx](https://amoy.polygonscan.com/tx/0x1e83cdfb29de1bbca5e439b414171e4df8c1b08e7880cc5b228c2bbea5d7584d) |
| check:amoy | ❌ NO（焼却後） | — |

---

## コスト実測（実演台ウォレット / Amoy）

| タイミング | 残高 | 差分 |
|---|---|---|
| 開始時 | 0.056421 POL | — |
| deploy:amoy 後 | 0.015244 POL | **−0.041177 POL**（deploy） |
| mint+burn 後（最終） | 0.008392 POL | **−0.006852 POL**（mint+burn） |
| **1通し合計** | | **−0.048029 POL** |

- deploy が支配的（約 0.041 POL）。mint+burn は約 0.007 POL。
- 7/8 のガス実測（deploy ≒0.044 POL）とほぼ整合。

---

## 本番（2026-09-18）へのアクション

- [ ] **⚠️ 実演台ウォレットの補充**: 現在 **0.008 POL** で1通し分に満たない。
      当日リハ＋本番の2回分として **0.1〜0.15 POL** まで faucet で補充する
      （[faucet.polygon.technology](https://faucet.polygon.technology/)、不足は Alchemy / QuickNode 併用）。
- [ ] 本番直前のイメージタグ固定（`:seminar-20260918`）は ops-checklist §3 のとおり。
- [ ] 手順・出力・ストーリーは README どおり再現できることを本記録で確認済み（要修正なし）。

## 片付け

```bash
docker compose down   # ローカルチェーンとその上のNFTを消す（練習台はそれでおしまい）
```
