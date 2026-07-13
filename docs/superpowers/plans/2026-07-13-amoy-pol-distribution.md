# Amoy テスト用POL 一括配布 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 参加者の提出アドレスへ Amoy テスト用POLを 0.1 POL ずつ冪等に一括配布する運営専用 hardhat タスク `distribute` を追加する。

**Architecture:** 既存の `tasks/handson.js` と同じ hardhat タスク方式。宛先パース（純関数・単体テスト対象）と送金処理（Amoy依存・ドライランで検証）を1ファイル `tasks/distribute.js` に分ける。送金元は `.env` の `SEMINAR_PRIVATE_KEY`（実演台ウォレット）を共用し、既存の `hardhat.config.js` の network/accounts をそのまま再利用する。

**Tech Stack:** Node.js / Hardhat 2.24 / ethers v6（hardhat-toolbox 同梱）/ Mocha + Chai。

## Global Constraints

- 送金額の目標は全員一律 **0.1 POL**（`ethers.parseEther("0.1")`）。定数はコード1箇所に置く。
- **冪等 top-up 方式**: 各宛先の現残高を見て `0.1 POL` に満たない不足分だけ送る。残高十分ならスキップ。
- **ドライラン既定**: `--execute` フラグが無い限り一切送金しない。
- 実演用予備 **0.15 POL**（`RESERVE`）を原資に残す。原資不足なら送金前に停止。
- 参加者アドレスは個人情報寄り。宛先ファイル置き場 `distribute/` は git 管理外にする。
- エラーは既存 `fail()` 同様「❌ 一行」で表示（スタックトレースを出さない）。

---

### Task 1: 宛先パーサ `parseRecipients`（純関数 + 単体テスト）

Slack/Discord から集めたテキストを受け取り、`0x…` アドレスを抽出・重複排除・チェックサム化する純関数。ネットワークに依存しないため TDD で作る。

**Files:**
- Create: `tasks/distribute.js`
- Test: `test/distribute.js`

**Interfaces:**
- Consumes: なし（`getAddress` 関数を引数で受け取る＝ethers非依存で単体テスト可能）
- Produces:
  - `parseRecipients(text: string, getAddress: (addr: string) => string): { recipients: string[], skipped: Array<{ lineNumber: number, text: string, reason: string }> }`
  - `recipients` はチェックサム済みアドレスの重複排除済み配列。`skipped` は弾いた行（不正・重複）の一覧。
  - 正規表現 `ADDRESS_RE = /0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/` は module 内定数として `execute` タスクと共有する。

- [ ] **Step 1: 失敗するテストを書く**

`test/distribute.js` を新規作成:

```js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseRecipients } = require("../tasks/distribute");

// getAddress を渡すことで純関数として検証する(設計書§4)
const getAddress = ethers.getAddress;

describe("parseRecipients(宛先パーサ)", function () {
  it("素のアドレスを1件抽出する", function () {
    const { recipients, skipped } = parseRecipients(
      "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      getAddress
    );
    expect(recipients).to.deep.equal([
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // チェックサム化される
    ]);
    expect(skipped).to.have.length(0);
  });

  it("日本語が混じった行からアドレスを抽出する", function () {
    const { recipients } = parseRecipients(
      "私のアドレスは 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 です",
      getAddress
    );
    expect(recipients).to.deep.equal([
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    ]);
  });

  it("重複(大文字小文字違い)を1件にまとめ、2件目をskippedに記録する", function () {
    const { recipients, skipped } = parseRecipients(
      [
        "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
        "0x70997970C51812DC3A010C7D01B50E0D17DC79C8",
      ].join("\n"),
      getAddress
    );
    expect(recipients).to.have.length(1);
    expect(skipped).to.have.length(1);
    expect(skipped[0].reason).to.equal("重複");
  });

  it("空行と # コメント行は黙って無視する(skippedにも入れない)", function () {
    const { recipients, skipped } = parseRecipients(
      ["", "# 参加者リスト", "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"].join(
        "\n"
      ),
      getAddress
    );
    expect(recipients).to.have.length(1);
    expect(skipped).to.have.length(0);
  });

  it("アドレスの無い非空行はskippedに記録する", function () {
    const { recipients, skipped } = parseRecipients("これはアドレスではない", getAddress);
    expect(recipients).to.have.length(0);
    expect(skipped).to.have.length(1);
    expect(skipped[0].reason).to.equal("アドレスが見つかりません");
  });

  it("秘密鍵(0x+64桁hex)を誤ってアドレスとして抽出しない(安全策)", function () {
    const privKey = "0x" + "a".repeat(64);
    const { recipients, skipped } = parseRecipients(privKey, getAddress);
    expect(recipients).to.have.length(0);
    expect(skipped).to.have.length(1);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `docker compose exec hardhat npm test`
Expected: FAIL（`Cannot find module '../tasks/distribute'` または `parseRecipients is not a function`）

- [ ] **Step 3: 最小実装を書く**

`tasks/distribute.js` を新規作成:

```js
// Amoy テスト用POL 一括配布(運営専用)。設計書: docs/superpowers/specs/2026-07-13-amoy-pol-distribution-design.md
// 宛先パース(parseRecipients)は純関数として単体テスト可能にしてある。

// 0x + 40桁hex ちょうど。直後がhexなら不採用(0x+64桁の秘密鍵の先頭40桁を誤検出しないため)。
const ADDRESS_RE = /0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/;

// text から宛先アドレスを抽出・重複排除・チェックサム化する。
// getAddress は ethers.getAddress 相当(単体テストのため注入する)。
function parseRecipients(text, getAddress) {
  const recipients = [];
  const skipped = [];
  const seen = new Set();

  text.split(/\r?\n/).forEach((line, i) => {
    const lineNumber = i + 1;
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) return; // 空行・コメントは無視

    const match = line.match(ADDRESS_RE);
    if (!match) {
      skipped.push({ lineNumber, text: trimmed, reason: "アドレスが見つかりません" });
      return;
    }

    const address = getAddress(match[0].toLowerCase()); // 小文字化してから正規のチェックサムに直す
    const key = address.toLowerCase();
    if (seen.has(key)) {
      skipped.push({ lineNumber, text: trimmed, reason: "重複" });
      return;
    }
    seen.add(key);
    recipients.push(address);
  });

  return { recipients, skipped };
}

module.exports = { parseRecipients, ADDRESS_RE };
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `docker compose exec hardhat npm test`
Expected: PASS（`parseRecipients` の6テストが緑。既存の SAJMemberNFT テストも緑のまま）

- [ ] **Step 5: コミット**

```bash
git add tasks/distribute.js test/distribute.js
git commit -m "feat: 宛先パーサ parseRecipients を追加(POL配布の抽出・重複排除・チェックサム)"
```

---

### Task 2: `distribute` タスク本体（ドライラン/送金）＋ 配線

パーサに送金計画・原資チェック・送金ループを足して hardhat タスクとして登録し、config・npm scripts・.gitignore を配線する。送金は Amoy 依存のため、localhost ドライランで配管を検証する。

**Files:**
- Modify: `tasks/distribute.js`（`task("distribute", …)` を追加）
- Modify: `hardhat.config.js:2`（`require("./tasks/distribute");` を追加）
- Modify: `package.json:17`（`distribute` / `distribute:amoy` スクリプトを追加）
- Modify: `.gitignore`（`distribute/` を追加）

**Interfaces:**
- Consumes: `parseRecipients`, `ADDRESS_RE`（Task 1）
- Produces: hardhat タスク `distribute`。呼び出し: `npm run distribute:amoy -- <file> [--execute]`

- [ ] **Step 1: `tasks/distribute.js` にタスクとヘルパを追加**

ファイル冒頭の `ADDRESS_RE` 定義の下に require を足し、末尾（`module.exports` の直前）にタスクを追加する。ファイル先頭を次に変更:

```js
// Amoy テスト用POL 一括配布(運営専用)。設計書: docs/superpowers/specs/2026-07-13-amoy-pol-distribution-design.md
// 宛先パース(parseRecipients)は純関数として単体テスト可能にしてある。
const { task } = require("hardhat/config");
const fs = require("fs");

// 参加者/運営向けエラーは1行で綺麗に(handson.js と同じ流儀)
function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}
```

`module.exports` の直前に次のタスクを追加:

```js
task("distribute", "提出アドレスへテスト用POLを一括配布する(運営用・冪等)")
  .addPositionalParam("file", "宛先アドレス一覧ファイル(1行1件、日本語混在可)")
  .addFlag("execute", "実際に送金する(未指定ならドライラン)")
  .setAction(async ({ file, execute }, hre) => {
    const { ethers } = hre;
    const TARGET = ethers.parseEther("0.1"); // 1人あたりの目標残高
    const RESERVE = ethers.parseEther("0.15"); // 実演用に原資へ残す予備
    const GAS_PER_TX = 21000n; // 素の送金は21000ガス固定

    if (!fs.existsSync(file)) {
      fail(`宛先ファイルが見つかりません: ${file}`);
    }
    const { recipients, skipped } = parseRecipients(
      fs.readFileSync(file, "utf8"),
      ethers.getAddress
    );
    for (const s of skipped) {
      console.log(`⚠️  L${s.lineNumber} スキップ(${s.reason}): ${s.text}`);
    }
    if (recipients.length === 0) {
      fail("有効な宛先アドレスが1件も見つかりませんでした");
    }

    const [signer] = await ethers.getSigners();
    if (!signer) {
      fail(
        "署名用アカウントがありません。cp .env.example .env して SEMINAR_PRIVATE_KEY を設定してください"
      );
    }
    const provider = ethers.provider;

    // 冪等 top-up: 各宛先の不足分(TARGET - 現残高)を算出
    const plan = [];
    let totalSend = 0n;
    for (const to of recipients) {
      const balance = await provider.getBalance(to);
      const amount = balance < TARGET ? TARGET - balance : 0n;
      plan.push({ to, amount });
      totalSend += amount;
    }
    const toSend = plan.filter((p) => p.amount > 0n);

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? 0n;
    const gasEstimate = GAS_PER_TX * gasPrice * BigInt(toSend.length);
    const need = totalSend + gasEstimate + RESERVE;
    const senderBalance = await provider.getBalance(signer.address);

    const fmt = (v) => ethers.formatEther(v);
    console.log(`\n📋 宛先: ${recipients.length}件(スキップ ${skipped.length}件)`);
    console.log(
      `   送金対象: ${toSend.length}件 / 合計 ${fmt(totalSend)} POL(残高十分でスキップ ${plan.length - toSend.length}件)`
    );
    console.log(
      `   原資: ${fmt(senderBalance)} POL / 必要 ${fmt(need)} POL(送金${fmt(totalSend)} + ガス概算${fmt(gasEstimate)} + 実演予備${fmt(RESERVE)})`
    );
    console.log(`   送金元: ${signer.address}`);

    if (senderBalance < need) {
      fail(`原資が不足しています。あと ${fmt(need - senderBalance)} POL 補充してください`);
    }
    if (!execute) {
      console.log(
        `\n💡 これはドライランです。実際に送金するには末尾に --execute を付けて再実行してください`
      );
      return;
    }

    console.log(`\n🚀 送金開始...`);
    let ok = 0;
    let failed = 0;
    for (const p of toSend) {
      try {
        const tx = await signer.sendTransaction({ to: p.to, value: p.amount });
        await tx.wait();
        ok++;
        console.log(`✅ ${p.to} へ ${fmt(p.amount)} POL`);
        if (hre.network.name === "amoy") {
          console.log(`   🌏 https://amoy.polygonscan.com/tx/${tx.hash}`);
        }
      } catch (e) {
        failed++;
        console.error(`❌ ${p.to} 送金失敗: ${e.message}`);
      }
    }
    console.log(
      `\n📊 完了: 成功 ${ok} / 失敗 ${failed} / スキップ ${plan.length - toSend.length}`
    );
    if (failed > 0) {
      console.log(`   失敗があります。同じコマンドを再実行すると未達の宛先だけ再送されます(冪等)`);
    }
  });
```

- [ ] **Step 2: `hardhat.config.js` にタスクを読み込ませる**

`hardhat.config.js:2` の `require("./tasks/handson");` の直後に1行足す:

```js
require("@nomicfoundation/hardhat-toolbox");
require("./tasks/handson");
require("./tasks/distribute");
```

- [ ] **Step 3: `package.json` に npm scripts を追加**

`"burn:amoy": …` の行の直後（`scripts` の末尾）に足す:

```json
    "burn:amoy": "hardhat --network amoy burn",
    "distribute": "hardhat --network localhost distribute",
    "distribute:amoy": "hardhat --network amoy distribute"
```

- [ ] **Step 4: `.gitignore` に宛先置き場を追加**

`.gitignore` の末尾に足す:

```
# 参加者アドレスの置き場(個人情報寄り。コミットしない)
distribute/
```

- [ ] **Step 5: 既存テストが壊れていないことを確認**

Run: `docker compose exec hardhat npm test`
Expected: PASS（Task 1 のパーサ6件 + 既存 SAJMemberNFT 全件が緑。タスク追加でロードエラーが出ないことの確認）

- [ ] **Step 6: localhost ドライランで配管をスモークテスト**

ローカルチェーンを起動し、残高0の新規アドレス2件でドライランする（送金しない・鍵不要）:

```bash
docker compose up -d
mkdir -p distribute
printf '0x1111111111111111111111111111111111111111\n0x2222222222222222222222222222222222222222\n' > distribute/recipients.txt
docker compose exec hardhat npm run distribute -- distribute/recipients.txt
```

Expected: 「送金対象: 2件 / 合計 0.2 POL」「原資: 10000.0 POL …」「💡 これはドライランです」が表示され、**送金は行われない**（`--execute` 無しのため）。`⚠️` スキップ行が出ないこと。

- [ ] **Step 7: コミット**

```bash
git add tasks/distribute.js hardhat.config.js package.json .gitignore
git commit -m "feat: distribute タスクを追加(POL一括配布・ドライラン既定・冪等top-up)"
```

---

### Task 3: 運営チェックリストへ手順を反映

`ops-checklist.md` §2 の「一括送付スクリプトを作れる（Claude Codeに依頼すればすぐ）」を、実装した具体コマンドに置き換える。

**Files:**
- Modify: `docs/ops-checklist.md:23-26`

**Interfaces:**
- Consumes: Task 2 の `distribute:amoy` コマンド
- Produces: なし（ドキュメントのみ）

- [ ] **Step 1: §2 の該当箇所を書き換える**

`docs/ops-checklist.md` の §2「POL配布」の箇条書き最後の行:

```markdown
  - アドレスリストが揃ったら一括送付スクリプトを作れる（Claude Codeに依頼すればすぐ）
```

を次に置き換える:

```markdown
  - **一括配布ツールあり**（`tasks/distribute.js`。設計: [spec](superpowers/specs/2026-07-13-amoy-pol-distribution-design.md)）:
    1. Slack/Discord の提出アドレスを `distribute/recipients.txt` に1行1件で貼る（前後に日本語が混じってもOK。`distribute/` はgit管理外）
    2. ドライランで件数・総額・原資充足を確認: `docker compose exec hardhat npm run distribute:amoy -- distribute/recipients.txt`
    3. 問題なければ実送金: 末尾に `--execute` を付けて再実行
    - 冪等（残高0.1 POL以上はスキップ・失敗は再実行で未達分だけ再送）。原資が足りなければ送金前に停止する
```

- [ ] **Step 2: 表示崩れがないか確認**

Run: `git diff docs/ops-checklist.md`
Expected: §2 の1行が上記の複数行ブロックに置き換わっている。他セクションは無変更。

- [ ] **Step 3: コミット**

```bash
git add docs/ops-checklist.md
git commit -m "docs: ops-checklist §2 に一括配布ツールの具体手順を反映"
```

---

## Self-Review

**1. Spec coverage:**
- §3 全体像（distribute タスク・npm script）→ Task 2 ✅
- §4 コンポーネント（parseRecipients / planTransfers / checkTreasury / execute）→ parseRecipients=Task 1、残りは Task 2 の setAction 内にインライン実装 ✅
- §5 冪等 top-up → Task 2 Step 1（`amount = balance < TARGET ? TARGET - balance : 0n`）✅
- §6 安全策（ドライラン既定・原資チェック・不正宛先可視化・進捗サマリ・gitignore）→ Task 2 ✅
- §7 データ形式（正規表現抽出・ドライラン出力）→ Task 1/2 ✅
- §8 エラーハンドリング（ファイル無し・0件・原資不足・個別失敗継続・署名無し）→ Task 2 ✅
- §9 テスト方針（parseRecipients単体・当日リハでdry-run→execute）→ Task 1 + Task 3手順 ✅
- §10/§11 運用手順・ドキュメント反映 → Task 3 ✅

**2. Placeholder scan:** TBD/TODO/「適宜」等なし。各コード step は完全なコードを含む ✅

**3. Type consistency:** `parseRecipients(text, getAddress) → { recipients, skipped:[{lineNumber,text,reason}] }` を Task 1 定義、Task 2 で同シグネチャで消費。`ADDRESS_RE` を module 定数として共有。`plan` 要素 `{ to, amount }` は Task 2 内で一貫 ✅
