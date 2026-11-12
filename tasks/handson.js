// SAJ Web3 NFT ハンズオン用タスク(設計書§7)
// Part3(localhost)とPart4(Amoy)で同一。--network の切替のみで両対応。
// npm scripts から呼ばれる: npm run mint -- 難波 / npm run mint:amoy -- 難波 など
const { task } = require("hardhat/config");
const fs = require("fs");
const path = require("path");

// 参加者向けエラーはスタックトレースを出さず1行で綺麗に表示する
function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

const DEPLOYMENTS_DIR = path.join(__dirname, "..", "deployments");

function deploymentFile(networkName) {
  return path.join(DEPLOYMENTS_DIR, `${networkName}.json`);
}

function saveDeployment(networkName, address) {
  fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  fs.writeFileSync(
    deploymentFile(networkName),
    JSON.stringify({ address }, null, 2) + "\n"
  );
}

function loadDeployment(networkName) {
  const file = deploymentFile(networkName);
  if (!fs.existsSync(file)) {
    fail(
      `${networkName} にデプロイ記録が見つかりません。先にデプロイしてください: npm run deploy${networkName === "amoy" ? ":amoy" : ""}`
    );
  }
  return JSON.parse(fs.readFileSync(file, "utf8")).address;
}

async function getSignerOrFail(hre) {
  const [signer] = await hre.ethers.getSigners();
  if (!signer) {
    fail(
      "署名用アカウントがありません。cp .env.example .env して SEMINAR_PRIVATE_KEY を設定してください(セミナー専用ウォレットの鍵)"
    );
  }
  return signer;
}

async function getNft(hre) {
  const address = loadDeployment(hre.network.name);
  const signer = await getSignerOrFail(hre);
  const nft = await hre.ethers.getContractAt("SAJMemberNFT", address, signer);
  return { nft, signer, address };
}

// Amoy のときだけ polygonscan のリンクを出す(公開検証性のごほうび層。設計書§6)
function printExplorerLink(hre, kind, value) {
  if (hre.network.name !== "amoy") return;
  console.log(`   🌏 https://amoy.polygonscan.com/${kind}/${value}`);
}

function decodeTokenURI(uri) {
  return JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString("utf8"));
}

// 自分が保有する最初のトークンを返す(未保有なら null)
async function findMyToken(nft, myAddress) {
  const balance = await nft.balanceOf(myAddress);
  if (balance === 0n) return null;
  return await nft.tokenOfOwnerByIndex(myAddress, 0);
}

task("deploy", "会員証NFT(練習台)をデプロイする").setAction(async (_, hre) => {
  const signer = await getSignerOrFail(hre);
  await hre.run("compile");
  console.log(`🚀 SAJMemberNFT を ${hre.network.name} にデプロイ中... (deployer: ${signer.address})`);
  const nft = await hre.ethers.deployContract("SAJMemberNFT", signer);
  await nft.waitForDeployment();
  const address = await nft.getAddress();
  saveDeployment(hre.network.name, address);
  console.log(`✅ デプロイ完了: ${address}`);
  console.log(`   (deployments/${hre.network.name}.json に保存しました)`);
  printExplorerLink(hre, "address", address);
});

task("mint", "自分に会員証(練習台)を1枚発行する")
  .addOptionalPositionalParam("member", "メタデータに刻む名前", "SAJ Member")
  .setAction(async ({ member }, hre) => {
    const { nft, signer } = await getNft(hre);
    console.log(`🎫 会員証(練習台)を発行中... member="${member}"`);
    const tx = await nft.mint(member);
    const receipt = await tx.wait();
    const transferLog = receipt.logs
      .map((log) => {
        try {
          return nft.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((log) => log && log.name === "Transfer");
    const tokenId = transferLog.args.tokenId;
    console.log(`✅ 発行完了! tokenId=${tokenId} owner=${signer.address}`);
    console.log(`   メタデータ: ${JSON.stringify(decodeTokenURI(await nft.tokenURI(tokenId)))}`);
    printExplorerLink(hre, "tx", tx.hash);
  });

task("check-membership", "指定アドレスが会員か判定する(token-gating)")
  .addPositionalParam("address", "判定するアドレス")
  .setAction(async ({ address }, hre) => {
    if (!hre.ethers.isAddress(address)) {
      fail(`アドレスの形式が正しくありません: ${address}`);
    }
    const contractAddress = loadDeployment(hre.network.name);
    const nft = await hre.ethers.getContractAt("SAJMemberNFT", contractAddress);
    const balance = await nft.balanceOf(address);
    console.log(`🔍 check-membership: ${address} (network: ${hre.network.name})`);
    if (balance > 0n) {
      console.log(`✅ YES — 会員です(保有数: ${balance})`);
    } else {
      console.log(`❌ NO — 会員証を保有していません`);
    }
  });

task("transfer", "自分の会員証を指定アドレスへ譲渡する(\"送れてしまう\"実演)")
  .addPositionalParam("to", "送り先アドレス")
  .setAction(async ({ to }, hre) => {
    if (!hre.ethers.isAddress(to)) {
      fail(`アドレスの形式が正しくありません: ${to}`);
    }
    const { nft, signer } = await getNft(hre);
    const tokenId = await findMyToken(nft, signer.address);
    if (tokenId === null) {
      fail("会員証を保有していません。先に発行してください: npm run mint -- <名前>");
    }
    console.log(`📤 tokenId=${tokenId} を ${to} へ譲渡中...`);
    const tx = await nft.transferFrom(signer.address, to, tokenId);
    await tx.wait();
    console.log(`✅ 譲渡完了 — 会員証が他人に渡ってしまいました(だから本物は Soulbound にします)`);
    printExplorerLink(hre, "tx", tx.hash);
  });

task("burn", "自分の会員証を焼却する(焼却儀式)").setAction(async (_, hre) => {
  const { nft, signer } = await getNft(hre);
  const tokenId = await findMyToken(nft, signer.address);
  if (tokenId === null) {
    fail("会員証を保有していません。焼却するものがありません");
  }
  console.log(`🔥 tokenId=${tokenId} を焼却中...`);
  const tx = await nft.burn(tokenId);
  await tx.wait();
  console.log(`✅ 焼却完了 — 練習台はここでおしまい。本物の会員証は将来 Base に。`);
  printExplorerLink(hre, "tx", tx.hash);
});
