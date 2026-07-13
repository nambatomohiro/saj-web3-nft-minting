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
