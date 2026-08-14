// Amoy テスト用POL の「貯める側」(運営専用)。配布側は tasks/distribute.js。
//
// 背景: 公式 faucet は廃止済みで、現行 faucet(Alchemy 等)は
//   - レート制限が「受け取りアドレス単位/24h」
//   - テストネット残高が多いアドレスは請求資格を失う
// という2点があるため、貯蔵ウォレットで直接請求することはできない。
// 「協力者が各自のアドレスで請求 → 貯蔵ウォレットへ転送(sweep)」が唯一回る運用になる。
// 運用手順は docs/ops-checklist.md §2 を参照。
//
// 金額計算は純関数として単体テスト可能にしてある(distribute.js と同じ流儀)。
const { task } = require("hardhat/config");
const fs = require("fs");
const path = require("path");
// 配布の基準値は distribute.js から借りる(「貯まった」判定と「配布できる」判定を一致させる)
const { parseRecipients, TARGET_POL, RESERVE_POL } = require("./distribute");

// 運営向けエラーは1行で綺麗に(handson.js / distribute.js と同じ流儀)
function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

const GAS_LIMIT = 21000n; // 素の送金は21000ガス固定
// 手数料の確保倍率。EIP-1559 では実際の消費は (baseFee + priority) 分だけで、
// 余りは返ってくる。ガス高騰でスタックするより残高を少し残すほうが安全なので多めに取る。
const FEE_MARGIN = 3n;

// 全額転送時の送金額を算出する(純関数)。
// EIP-1559 では残高 >= value + gasLimit * maxFeePerGas が要求されるため、
// 手数料は「上限 × gasLimit」を丸ごと確保した残りを送る。
function sweepAmount({ balance, feePerGas, keep = 0n, gasLimit = GAS_LIMIT }) {
  const cap = feePerGas * FEE_MARGIN; // トランザクションに設定する上限単価
  const reserve = gasLimit * cap;
  return { cap, reserve, value: balance - reserve - keep };
}

// 貯蔵ウォレットの必要額と進捗を算出する(純関数)。
function fundingPlan({ balance, participants, perParticipant, reserve }) {
  const required = perParticipant * BigInt(participants) + reserve;
  const shortfall = balance < required ? required - balance : 0n;
  // 達成率(整数%)。100を超えることもある(超過達成)
  const percent = required === 0n ? 100 : Number((balance * 100n) / required);
  return { required, shortfall, percent };
}

// 達成率のテキストバー。100%超は満タン表示にする。
function progressBar(percent, width = 20) {
  const filled = Math.min(width, Math.max(0, Math.round((percent / 100) * width)));
  return "█".repeat(filled) + "░".repeat(width - filled);
}

// POL 表記の文字列をweiに変換する。不正なら運営向けに1行で落とす。
function parsePol(hre, value, optionName) {
  try {
    return hre.ethers.parseEther(value);
  } catch {
    fail(`${optionName} の値が数値として読めません: ${value}`);
  }
}

// 貯蔵ウォレットのアドレスを解決する(--to/--address > TREASURY_ADDRESS)。
function resolveTreasury(hre, explicit) {
  const raw = explicit || process.env.TREASURY_ADDRESS;
  if (!raw) return null;
  try {
    return hre.ethers.getAddress(raw.trim());
  } catch {
    fail(
      `貯蔵ウォレットのアドレスが不正です: ${raw}(.env の TREASURY_ADDRESS を確認してください)`
    );
  }
}

task("sweep", "自分のウォレットのPOLを貯蔵ウォレットへ全額転送する(運営・協力者用)")
  .addOptionalParam("to", "貯蔵ウォレットのアドレス(未指定なら .env の TREASURY_ADDRESS)")
  .addOptionalParam("keep", "手元に残すPOL(既定: 0)", "0")
  .addFlag("execute", "実際に送金する(未指定ならドライラン)")
  .setAction(async ({ to, keep, execute }, hre) => {
    const { ethers } = hre;

    const treasury = resolveTreasury(hre, to);
    if (!treasury) {
      fail(
        "貯蔵ウォレットのアドレスが指定されていません。--to 0x... を渡すか、.env に TREASURY_ADDRESS を設定してください"
      );
    }
    const keepWei = parsePol(hre, keep, "--keep");

    const [signer] = await ethers.getSigners();
    if (!signer) {
      fail(
        "署名用アカウントがありません。cp .env.example .env して SEMINAR_PRIVATE_KEY を設定してください"
      );
    }
    if (signer.address.toLowerCase() === treasury.toLowerCase()) {
      fail("送金元と貯蔵ウォレットが同じアドレスです。請求用ウォレットの鍵で実行してください");
    }

    const provider = ethers.provider;
    const balance = await provider.getBalance(signer.address);
    const feeData = await provider.getFeeData();
    // EIP-1559 が使えるなら maxFeePerGas、無ければ legacy の gasPrice
    const feePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;
    if (!feePerGas) {
      fail("ガス価格を取得できませんでした。RPCエンドポイント(AMOY_RPC_URL)を確認してください");
    }

    const { cap, reserve, value } = sweepAmount({ balance, feePerGas, keep: keepWei });

    const fmt = (v) => ethers.formatEther(v);
    console.log(`\n🧹 送金元: ${signer.address}`);
    console.log(`   残高: ${fmt(balance)} POL`);
    console.log(`   宛先(貯蔵): ${treasury}`);
    console.log(
      `   手数料確保: ${fmt(reserve)} POL(${GAS_LIMIT} gas × ${ethers.formatUnits(cap, "gwei")} gwei)${
        keepWei > 0n ? ` / 手元に残す: ${fmt(keepWei)} POL` : ""
      }`
    );

    if (value <= 0n) {
      // 日次ループで回すため、送るものが無いのはエラーにしない
      console.log(`\n💤 送金できる残高がありません(手数料と手元分を引くと ${fmt(value)} POL)`);
      return;
    }
    console.log(`   送金額: ${fmt(value)} POL`);

    if (!execute) {
      console.log(
        `\n💡 これはドライランです。実際に送金するには末尾に --execute を付けて再実行してください`
      );
      return;
    }

    console.log(`\n🚀 送金中...`);
    // 手数料は上記で確保した上限をそのまま設定する(見積りと実際の設定をずらさない)
    const feeFields =
      feeData.maxFeePerGas != null
        ? {
            maxFeePerGas: cap,
            maxPriorityFeePerGas:
              feeData.maxPriorityFeePerGas != null && feeData.maxPriorityFeePerGas < cap
                ? feeData.maxPriorityFeePerGas
                : cap,
          }
        : { gasPrice: cap };
    const tx = await signer.sendTransaction({
      to: treasury,
      value,
      gasLimit: GAS_LIMIT,
      ...feeFields,
    });
    const receipt = await tx.wait();
    console.log(`✅ ${fmt(value)} POL を送金しました`);
    if (hre.network.name === "amoy") {
      console.log(`   🌏 https://amoy.polygonscan.com/tx/${tx.hash}`);
    }
    const after = await provider.getBalance(signer.address);
    console.log(
      `   実際のガス消費: ${fmt(receipt.gasUsed * receipt.gasPrice)} POL / 手元の残り: ${fmt(after)} POL`
    );
    console.log(`   貯蔵ウォレットの進捗確認: npm run funding-status:amoy`);
  });

task("funding-status", "貯蔵ウォレットの残高と必要額(あと何POL)を表示する(運営用)")
  .addOptionalParam("address", "貯蔵ウォレットのアドレス(未指定なら .env の TREASURY_ADDRESS)")
  .addOptionalParam("file", "宛先アドレス一覧ファイル(あれば人数をここから数える)")
  .addOptionalParam("participants", "宛先ファイルが無いときの想定参加者数(既定: 30)", "30")
  .addOptionalParam("per", `参加者1人あたりの配布POL(既定: ${TARGET_POL}・distributeと同値)`, TARGET_POL)
  .addOptionalParam("reserve", `実演・予備として残すPOL(既定: ${RESERVE_POL}・distributeと同値)`, RESERVE_POL)
  .setAction(async ({ address, file, participants, per, reserve }, hre) => {
    const { ethers } = hre;

    let treasury = resolveTreasury(hre, address);
    if (!treasury) {
      // 貯蔵ウォレットの鍵を .env に持っている想定で、署名者にフォールバックする
      const [signer] = await ethers.getSigners();
      if (!signer) {
        fail(
          "貯蔵ウォレットのアドレスが分かりません。--address 0x... を渡すか、.env に TREASURY_ADDRESS を設定してください"
        );
      }
      treasury = signer.address;
    }

    const perWei = parsePol(hre, per, "--per");
    const reserveWei = parsePol(hre, reserve, "--reserve");

    // 宛先ファイルがあれば実際の提出人数を使う(提出が進むほど必要額が正確になる)
    const listPath = file || path.join(__dirname, "..", "distribute", "recipients.txt");
    let count;
    let countSource;
    if (fs.existsSync(listPath)) {
      const { recipients } = parseRecipients(fs.readFileSync(listPath, "utf8"), ethers.getAddress);
      count = recipients.length;
      countSource = `${listPath} の提出済み ${count}件`;
    } else {
      count = Number(participants);
      if (!Number.isInteger(count) || count < 0) {
        fail(`--participants は0以上の整数で指定してください: ${participants}`);
      }
      countSource = `想定 ${count}人(宛先ファイル未作成)`;
    }

    const balance = await ethers.provider.getBalance(treasury);
    const { required, shortfall, percent } = fundingPlan({
      balance,
      participants: count,
      perParticipant: perWei,
      reserve: reserveWei,
    });

    const fmt = (v) => ethers.formatEther(v);
    console.log(`\n🏦 貯蔵ウォレット: ${treasury}`);
    console.log(`   人数: ${countSource}`);
    console.log(
      `   必要額: ${fmt(required)} POL(配布 ${fmt(perWei)} × ${count}人 + 実演予備 ${fmt(reserveWei)})`
    );
    console.log(`   現在残高: ${fmt(balance)} POL`);
    console.log(`\n   ${progressBar(percent)} ${percent}%`);

    if (shortfall > 0n) {
      console.log(`\n⏳ あと ${fmt(shortfall)} POL 必要です`);
      // 現行 faucet の実測レンジ(Alchemy: アカウント有0.5 / 無0.2)から日数の目安を出す
      const perDay = ethers.parseEther("0.2");
      const days = Number((shortfall + perDay - 1n) / perDay);
      console.log(
        `   目安: 協力者1人が0.2 POL/日で請求して約${days}日 / 3人体制なら約${Math.ceil(days / 3)}日`
      );
      console.log(`   請求後は各自 npm run sweep:amoy -- --execute で貯蔵ウォレットへ転送`);
    } else {
      console.log(`\n✅ 必要額に到達しています(超過 ${fmt(balance - required)} POL)`);
      console.log(`   配布に進めます: npm run distribute:amoy -- distribute/recipients.txt`);
    }

    if (hre.network.name === "amoy") {
      console.log(`\n   🌏 https://amoy.polygonscan.com/address/${treasury}`);
    }
  });

module.exports = { sweepAmount, fundingPlan, progressBar, GAS_LIMIT, FEE_MARGIN };
