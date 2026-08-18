// Amoy テスト用POL 一括配布(運営専用)。設計書: docs/superpowers/specs/2026-07-13-amoy-pol-distribution-design.md
// 宛先パース(parseRecipients)は純関数として単体テスト可能にしてある。
const { task } = require("hardhat/config");
const fs = require("fs");

// 参加者/運営向けエラーは1行で綺麗に(handson.js と同じ流儀)
function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

// 0x + 40桁hex ちょうど。直後がhexなら不採用(0x+64桁の秘密鍵の先頭40桁を誤検出しないため)。
const ADDRESS_RE = /0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/;

// 配布の基準値。tasks/collect.js の funding-status も同じ値を使う
// (「貯まった」判定と「配布できる」判定がズレないように1か所で持つ)。
//
// 2026-08-15 改定(旧値 0.1 / 0.15)。旧値は「30 gwei」かつ「POLが希少」という
// 2つの前提で切り詰めた数字だったが、どちらも崩れた:
//   - ガス実測が 45.5 gwei まで上昇し、全工程1周が 0.044 → 約0.067 POL になった。
//     0.1 POL では1周半しか回らず、デプロイをやり直した参加者がガス切れになる。
//   - Polygon Labs のフォーム申請で 100 POL を確保済み(ops-checklist §2)。
//     30人に配っても 9.5 POL で、原資を切り詰める理由がなくなった。
// ガス価格が倍(90 gwei)になっても複数周まわる値にしてある。
const TARGET_POL = "0.3"; // 1人あたりの目標残高(45.5 gwei で約4周ぶん)
const RESERVE_POL = "0.5"; // 実演用に原資へ残す予備(同 約7周ぶん。ops-checklist §4)

// text から宛先アドレスを抽出・重複排除・チェックサム化する。
// getAddress は ethers.getAddress 相当(単体テストのため注入する)。
function parseRecipients(text, getAddress) {
  const recipients = [];
  const skipped = [];
  const seen = new Set();

  const re = new RegExp(ADDRESS_RE.source, "g");

  text.split(/\r?\n/).forEach((line, i) => {
    const lineNumber = i + 1;
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) return; // 空行・コメントは無視

    const matches = trimmed.match(re);
    if (!matches) {
      skipped.push({ lineNumber, text: trimmed, reason: "アドレスが見つかりません" });
      return;
    }

    for (const raw of matches) {
      // 小文字化せずそのまま渡す: 本物の大文字小文字混在でチェックサムが
      // 誤っている(=入力ミスの疑いが高い)場合は getAddress が throw するので拾う。
      // 全て小文字・全て大文字の場合はチェックサム検証されず素通しで正規化される。
      let address;
      try {
        address = getAddress(raw);
      } catch {
        skipped.push({ lineNumber, text: trimmed, reason: "チェックサム不正" });
        continue;
      }
      const key = address.toLowerCase();
      if (seen.has(key)) {
        skipped.push({ lineNumber, text: trimmed, reason: "重複" });
        continue;
      }
      seen.add(key);
      recipients.push(address);
    }
  });

  return { recipients, skipped };
}

task("distribute", "提出アドレスへテスト用POLを一括配布する(運営用・冪等)")
  .addPositionalParam("file", "宛先アドレス一覧ファイル(1行1件、日本語混在可)")
  .addFlag("execute", "実際に送金する(未指定ならドライラン)")
  .setAction(async ({ file, execute }, hre) => {
    const { ethers } = hre;
    const TARGET = ethers.parseEther(TARGET_POL); // 1人あたりの目標残高
    const RESERVE = ethers.parseEther(RESERVE_POL); // 実演用に原資へ残す予備
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

module.exports = { parseRecipients, ADDRESS_RE, TARGET_POL, RESERVE_POL };
