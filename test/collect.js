const { expect } = require("chai");
const { ethers } = require("hardhat");
const { sweepAmount, fundingPlan, progressBar, GAS_LIMIT, FEE_MARGIN } = require("../tasks/collect");
const { TARGET_POL, RESERVE_POL } = require("../tasks/distribute");

const pol = (v) => ethers.parseEther(v);
const gwei = (v) => ethers.parseUnits(v, "gwei");

describe("sweepAmount(全額転送の送金額)", function () {
  it("残高から手数料の確保分を引いた額を返す", function () {
    const balance = pol("1.0");
    const feePerGas = gwei("30");
    const { cap, reserve, value } = sweepAmount({ balance, feePerGas });

    expect(cap).to.equal(gwei("30") * FEE_MARGIN);
    expect(reserve).to.equal(GAS_LIMIT * cap);
    expect(value).to.equal(balance - reserve);
  });

  it("確保額は必ず「21000ガス × 設定する上限単価」と一致する(残高不足でrevertしないため)", function () {
    const { cap, reserve } = sweepAmount({ balance: pol("1.0"), feePerGas: gwei("75") });
    // トランザクションに設定する上限で丸ごと確保していること
    expect(reserve).to.equal(GAS_LIMIT * cap);
  });

  it("--keep の分を追加で手元に残す", function () {
    const balance = pol("1.0");
    const feePerGas = gwei("30");
    const keep = pol("0.25");
    const withoutKeep = sweepAmount({ balance, feePerGas });
    const withKeep = sweepAmount({ balance, feePerGas, keep });

    expect(withKeep.value).to.equal(withoutKeep.value - keep);
  });

  it("残高が手数料に満たないと送金額が0以下になる(呼び出し側がスキップする)", function () {
    const { value } = sweepAmount({ balance: 1000n, feePerGas: gwei("30") });
    expect(value).to.be.lessThan(0n);
  });

  it("残高0なら送金額は負になる", function () {
    const { value } = sweepAmount({ balance: 0n, feePerGas: gwei("30") });
    expect(value).to.be.lessThan(0n);
  });

  it("ガス価格が3倍でも1 POLの残高なら大部分を送れる(確保は誤差レベル)", function () {
    const balance = pol("1.0");
    const { value } = sweepAmount({ balance, feePerGas: gwei("90") });
    // 21000 * 270gwei = 0.00567 POL しか確保しない
    expect(value).to.be.greaterThan(pol("0.99"));
  });
});

describe("fundingPlan(貯蔵ウォレットの必要額)", function () {
  it("必要額 = 1人あたり × 人数 + 予備", function () {
    const { required } = fundingPlan({
      balance: 0n,
      participants: 30,
      perParticipant: pol("0.1"),
      reserve: pol("0.5"),
    });
    expect(required).to.equal(pol("3.5"));
  });

  it("不足分と達成率を返す", function () {
    const { shortfall, percent } = fundingPlan({
      balance: pol("1.4"),
      participants: 30,
      perParticipant: pol("0.1"),
      reserve: pol("0.5"),
    });
    expect(shortfall).to.equal(pol("2.1"));
    expect(percent).to.equal(40); // 1.4 / 3.5
  });

  it("必要額に到達していれば不足は0(達成率は100超もありうる)", function () {
    const { shortfall, percent } = fundingPlan({
      balance: pol("7.0"),
      participants: 30,
      perParticipant: pol("0.1"),
      reserve: pol("0.5"),
    });
    expect(shortfall).to.equal(0n);
    expect(percent).to.equal(200);
  });

  it("提出0人でも予備分は必要額に残る", function () {
    const { required, shortfall } = fundingPlan({
      balance: 0n,
      participants: 0,
      perParticipant: pol("0.1"),
      reserve: pol("0.5"),
    });
    expect(required).to.equal(pol("0.5"));
    expect(shortfall).to.equal(pol("0.5"));
  });

  // funding-status が「到達」と言ったのに distribute が原資不足で止まる、を防ぐ
  it("distribute と同じ基準値を使えば、必要額は distribute の要求と一致する", function () {
    const { required, shortfall } = fundingPlan({
      balance: pol(TARGET_POL) * 30n + pol(RESERVE_POL),
      participants: 30,
      perParticipant: pol(TARGET_POL),
      reserve: pol(RESERVE_POL),
    });
    // distribute は「送金総額 + ガス + RESERVE」を要求する。
    // 残高0の宛先30人ぶんの送金総額 = TARGET × 30 なので、これで過不足なく足りる
    expect(required).to.equal(pol(TARGET_POL) * 30n + pol(RESERVE_POL));
    expect(shortfall).to.equal(0n);
  });

  it("必要額が0なら達成率は100(ゼロ除算しない)", function () {
    const { required, shortfall, percent } = fundingPlan({
      balance: 0n,
      participants: 0,
      perParticipant: pol("0.1"),
      reserve: 0n,
    });
    expect(required).to.equal(0n);
    expect(shortfall).to.equal(0n);
    expect(percent).to.equal(100);
  });
});

describe("progressBar(達成率バー)", function () {
  it("0%は空、100%は満タン", function () {
    expect(progressBar(0, 10)).to.equal("░".repeat(10));
    expect(progressBar(100, 10)).to.equal("█".repeat(10));
  });

  it("100%超でもバーからはみ出さない", function () {
    expect(progressBar(250, 10)).to.equal("█".repeat(10));
  });

  it("途中は比率に応じて埋まる", function () {
    expect(progressBar(40, 10)).to.equal("█".repeat(4) + "░".repeat(6));
  });
});
