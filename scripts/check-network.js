/**
 * @version v34
 */

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId);
}

main();