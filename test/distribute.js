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
