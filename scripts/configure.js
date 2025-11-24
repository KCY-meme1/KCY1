const hre = require("hardhat");

async function main() {
  const tokenAddress = "0xF8EEA8E071184AF41127Bf95da23D1d4879Cf41F";
  
  console.log("Connecting to token...");
  const token = await hre.ethers.getContractAt(
    "KCY1Token", 
    tokenAddress
  );
  
  console.log("Distributing tokens...");
  const tx = await token.distributeInitialAllocations();
  await tx.wait();
  console.log("Done:", tx.hash);
  
  const result = await token.getDistributionAddresses();
  console.log("Dev:", result[0]);
  console.log("Marketing:", result[1]);
  console.log("Team:", result[2]);
  console.log("Advisor:", result[3]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });