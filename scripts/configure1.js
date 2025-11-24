async function main() {
  const tokenAddress = "АДРЕС_НА_ТОКЕНА";
  const token = await ethers.getContractAt("KCY1Token", tokenAddress);

  // 1. Distribute tokens
  console.log("Distributing tokens...");
  await token.distributeInitialAllocations();

  // 2. Set exempt addresses (примерни адреси)
  const exemptAddrs = [
    "0x1234...", // eAddr1
    "0x5678...", // eAddr2
    "0x9abc...", // eAddr3
    "0xdef0..."  // eAddr4
  ];
  await token.updateExemptSlots(exemptAddrs);

  console.log("Configuration complete!");
}

main();