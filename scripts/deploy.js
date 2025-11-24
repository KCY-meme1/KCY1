async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const KCY1 = await ethers.getContractFactory("KCY1Token");
  const token = await KCY1.deploy();
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log("Token deployed to:", address);
  console.log("Wait 48h until:", new Date(Date.now() + 48*60*60*1000));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});