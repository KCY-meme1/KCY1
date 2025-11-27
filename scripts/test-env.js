/**
 * @version v34
 */

require("dotenv").config();

console.log("Private Key:", process.env.PRIVATE_KEY ? "✅ Loaded" : "❌ Missing");
console.log("BSCScan API Key:", process.env.BSCSCAN_API_KEY ? "✅ Loaded" : "❌ Missing");
console.log("API Key length:", process.env.BSCSCAN_API_KEY?.length || 0);