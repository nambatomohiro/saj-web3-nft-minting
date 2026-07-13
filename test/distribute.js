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

  it("1行に複数のアドレスがあれば両方とも抽出する(M1)", function () {
    const { recipients, skipped } = parseRecipients(
      "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      getAddress
    );
    expect(recipients).to.have.length(2);
    expect(recipients).to.deep.equal([
      "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    ]);
    expect(skipped).to.have.length(0);
  });

  it("チェックサム不正な(本物の)混在大文字小文字アドレスはskippedに記録し採用しない(M4)", function () {
    // 有効なチェックサム: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
    // "b"→"B" に1文字だけ反転してチェックサムを壊した(混在大文字小文字のまま)。
    // in-container で getAddress() が実際に throw することを確認済み(報告書参照)。
    const badChecksum = "0x70997970C51812dc3A010C7d01B50e0d17dc79C8";
    const { recipients, skipped } = parseRecipients(badChecksum, getAddress);
    expect(recipients).to.have.length(0);
    expect(skipped).to.have.length(1);
    expect(skipped[0].reason).to.equal("チェックサム不正");
  });

  it("全て大文字のアドレスはチェックサム検証されずに採用される", function () {
    const allUpper = "0X70997970C51812DC3A010C7D01B50E0D17DC79C8".replace(
      "0X",
      "0x"
    );
    const { recipients, skipped } = parseRecipients(allUpper, getAddress);
    expect(recipients).to.deep.equal([
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    ]);
    expect(skipped).to.have.length(0);
  });
});
