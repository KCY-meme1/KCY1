// KCY1 Token - Comprehensive Test Suite
// Използвай Hardhat или Truffle за изпълнение

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("KCY1 Token - Full Test Suite", function() {
    let token;
    let owner;
    let addr1, addr2, addr3, addr4, addr5;
    let exemptAddr1, exemptAddr2;
    
    const TOTAL_SUPPLY = ethers.parseEther("1000000");
    const OWNER_BALANCE = ethers.parseEther("600000");
    const CONTRACT_BALANCE = ethers.parseEther("400000");
    const MAX_TX = ethers.parseEther("1000");
    const MAX_WALLET = ethers.parseEther("20000");
    
    beforeEach(async function() {
        [owner, addr1, addr2, addr3, addr4, addr5, exemptAddr1, exemptAddr2] = await ethers.getSigners();
        
        const KCY1Token = await ethers.getContractFactory("KCY1Token");
        token = await KCY1Token.deploy();
        await token.waitForDeployment();
    });
    
    // ============================================
    // ТЕСТ 1: DEPLOY И ОСНОВНИ ПАРАМЕТРИ
    // ============================================
    describe("1. Deploy и начални параметри", function() {
        it("Трябва да има правилно име и символ", async function() {
            expect(await token.name()).to.equal("KCY1");
            expect(await token.symbol()).to.equal("KCY1");
            expect(await token.decimals()).to.equal(18);
        });
        
        it("Трябва да има правилен total supply", async function() {
            expect(await token.totalSupply()).to.equal(TOTAL_SUPPLY);
        });
        
        it("Трябва да разпредели токените правилно", async function() {
            expect(await token.balanceOf(owner.address)).to.equal(OWNER_BALANCE);
            expect(await token.balanceOf(await token.getAddress())).to.equal(CONTRACT_BALANCE);
        });
        
        it("Owner трябва да е правилен", async function() {
            expect(await token.owner()).to.equal(owner.address);
        });
        
        it("Търговията трябва да е блокирана първите 48 часа", async function() {
            expect(await token.isTradingEnabled()).to.equal(false);
            const timeLeft = await token.timeUntilTradingEnabled();
            expect(timeLeft).to.be.gt(0);
        });
    });
    
    // ============================================
    // ТЕСТ 2: EXEMPT АДРЕСИ (ПРЕДИ LOCK)
    // ============================================
    describe("2. Exempt адреси - Задаване и Lock", function() {
        it("Трябва да може да зададе exempt адреси ПРЕДИ lock", async function() {
            const router = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
            const factory = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
            
            await token.setExemptAddresses(
                [exemptAddr1.address, exemptAddr2.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress],
                router,
                factory
            );
            
            expect(await token.isExemptAddress(exemptAddr1.address)).to.equal(true);
            expect(await token.isExemptAddress(exemptAddr2.address)).to.equal(true);
            expect(await token.isExemptAddress(addr1.address)).to.equal(false);
        });
        
        it("Трябва да може да променя exempt адресите МНОГОКРАТНО преди lock", async function() {
            const router = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
            const factory = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
            
            // Първо задаване
            await token.setExemptAddresses(
                [exemptAddr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress],
                router,
                factory
            );
            expect(await token.isExemptAddress(exemptAddr1.address)).to.equal(true);
            
            // Второ задаване (променя)
            await token.setExemptAddresses(
                [exemptAddr2.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress],
                router,
                factory
            );
            expect(await token.isExemptAddress(exemptAddr1.address)).to.equal(false);
            expect(await token.isExemptAddress(exemptAddr2.address)).to.equal(true);
        });
        
        it("Lock трябва да блокира промени ЗАВИНАГИ", async function() {
            const router = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
            const factory = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
            
            await token.setExemptAddresses(
                [exemptAddr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress],
                router,
                factory
            );
            
            // Lock
            await token.lockExemptAddresses();
            expect(await token.exemptAddressesLocked()).to.equal(true);
            
            // Опит за промяна след lock - трябва да FAIL
            await expect(
                token.setExemptAddresses(
                    [exemptAddr2.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress],
                    router,
                    factory
                )
            ).to.be.revertedWith("Exempt addresses are locked forever");
        });
        
        it("getExemptAddresses() трябва да връща правилна информация", async function() {
            const router = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
            const factory = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
            
            await token.setExemptAddresses(
                [exemptAddr1.address, exemptAddr2.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress],
                router,
                factory
            );
            
            const result = await token.getExemptAddresses();
            expect(result.addresses[0]).to.equal(exemptAddr1.address);
            expect(result.addresses[1]).to.equal(exemptAddr2.address);
            expect(result.router).to.equal(router);
            expect(result.factory).to.equal(factory);
            expect(result.locked).to.equal(false);
        });
    });
    
    // ============================================
    // ТЕСТ 3: ТРАНСФЕРИ С ТАКСИ
    // ============================================
    describe("3. Трансфери и такси", function() {
        beforeEach(async function() {
            // Изчакваме 48 часа за да се активира търговията
            await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine");
            
            // Даваме токени на addr1 за тестване
            await token.transfer(addr1.address, ethers.parseEther("10000"));
        });
        
        it("Обикновен трансфер трябва да има 3% burn + 5% owner fee", async function() {
            const amount = ethers.parseEther("1000");
            const burnFee = amount * 3n / 100n;
            const ownerFee = amount * 5n / 100n;
            const transferAmount = amount - burnFee - ownerFee;
            
            const initialSupply = await token.totalSupply();
            const initialOwnerBalance = await token.balanceOf(owner.address);
            
            await token.connect(addr1).transfer(addr2.address, amount);
            
            // Проверка на получените токени
            expect(await token.balanceOf(addr2.address)).to.equal(transferAmount);
            
            // Проверка на изгорените токени
            expect(await token.totalSupply()).to.equal(initialSupply - burnFee);
            
            // Проверка на owner таксата
            expect(await token.balanceOf(owner.address)).to.be.gt(initialOwnerBalance);
        });
        
        it("Exempt адреси НЕ трябва да плащат такси", async function() {
            const router = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
            const factory = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
            
            await token.setExemptAddresses(
                [addr3.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress],
                router,
                factory
            );
            
            // Даваме токени на exempt адрес
            await token.transfer(addr3.address, ethers.parseEther("5000"));
            
            const amount = ethers.parseEther("1000");
            const initialSupply = await token.totalSupply();
            
            await token.connect(addr3).transfer(addr4.address, amount);
            
            // БЕЗ такси - получава пълната сума
            expect(await token.balanceOf(addr4.address)).to.equal(amount);
            
            // БЕЗ изгаряне
            expect(await token.totalSupply()).to.equal(initialSupply);
        });
        
        it("Owner трансферите НЕ трябва да имат такси", async function() {
            const amount = ethers.parseEther("5000");
            const initialSupply = await token.totalSupply();
            
            await token.transfer(addr2.address, amount);
            
            expect(await token.balanceOf(addr2.address)).to.equal(amount);
            expect(await token.totalSupply()).to.equal(initialSupply);
        });
    });
    
    // ============================================
    // ТЕСТ 4: ЛИМИТИ (MAX TX + MAX WALLET)
    // ============================================
    describe("4. Transaction и Wallet лимити", function() {
        beforeEach(async function() {
            await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine");
            
            await token.transfer(addr1.address, ethers.parseEther("15000"));
        });
        
        it("НЕ трябва да позволява трансфер над 1000 токена", async function() {
            const overLimit = ethers.parseEther("1001");
            
            await expect(
                token.connect(addr1).transfer(addr2.address, overLimit)
            ).to.be.revertedWith("Exceeds max transaction (1000 tokens)");
        });
        
        it("НЕ трябва да позволява портфейл над 20,000 токена", async function() {
            // Изпращаме 1000 токена 20 пъти
            for(let i = 0; i < 20; i++) {
                await token.connect(addr1).transfer(addr2.address, ethers.parseEther("920")); // С такси ще стане ~920
                await ethers.provider.send("evm_increaseTime", [2 * 60 * 60 + 1]); // 2 часа cooldown
                await ethers.provider.send("evm_mine");
            }
            
            // 21-вият трансфер трябва да FAIL
            await expect(
                token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Recipient would exceed max wallet (20,000 tokens)");
        });
        
        it("Exempt адреси НЕ трябва да имат лимити", async function() {
            const router = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
            const factory = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
            
            await token.setExemptAddresses(
                [addr3.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress],
                router,
                factory
            );
            
            const overLimit = ethers.parseEther("50000");
            await token.transfer(addr3.address, overLimit);
            
            // Трябва да успее (exempt адреси нямат лимити)
            expect(await token.balanceOf(addr3.address)).to.equal(overLimit);
        });
    });
    
    // ============================================
    // ТЕСТ 5: COOLDOWN (2 ЧАСА)
    // ============================================
    describe("5. Cooldown период между транзакции", function() {
        beforeEach(async function() {
            await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine");
            
            await token.transfer(addr1.address, ethers.parseEther("10000"));
        });
        
        it("НЕ трябва да позволява два трансфера за по-малко от 2 часа", async function() {
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("500"));
            
            // Опит за втори трансфер веднага
            await expect(
                token.connect(addr1).transfer(addr3.address, ethers.parseEther("500"))
            ).to.be.revertedWith("Must wait 2 hours between transactions");
        });
        
        it("ТРЯБВА да позволява трансфер след 2 часа", async function() {
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("500"));
            
            // Изчакваме 2 часа
            await ethers.provider.send("evm_increaseTime", [2 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine");
            
            // Втори трансфер трябва да успее
            await token.connect(addr1).transfer(addr3.address, ethers.parseEther("500"));
            expect(await token.balanceOf(addr3.address)).to.be.gt(0);
        });
    });
    
    // ============================================
    // ТЕСТ 6: ПАУЗА (48 ЧАСА)
    // ============================================
    describe("6. Pause механизъм", function() {
        beforeEach(async function() {
            await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine");
            
            await token.transfer(addr1.address, ethers.parseEther("5000"));
        });
        
        it("Owner трябва да може да активира pause", async function() {
            await token.pause();
            expect(await token.isPaused()).to.equal(true);
        });
        
        it("По време на pause трансферите трябва да FAIL", async function() {
            await token.pause();
            
            await expect(
                token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Contract is paused");
        });
        
        it("След 48 часа pause трябва автоматично да се деактивира", async function() {
            await token.pause();
            
            // Изчакваме 48 часа
            await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine");
            
            // Трансферът трябва да успее
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"));
            expect(await token.balanceOf(addr2.address)).to.be.gt(0);
        });
    });
    
    // ============================================
    // ТЕСТ 7: BLACKLIST
    // ============================================
    describe("7. Blacklist функционалност", function() {
        beforeEach(async function() {
            await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine");
            
            await token.transfer(addr1.address, ethers.parseEther("5000"));
        });
        
        it("Blacklist-натият адрес НЕ може да изпраща токени", async function() {
            await token.setBlacklist(addr1.address, true);
            
            await expect(
                token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Sender is blacklisted");
        });
        
        it("Blacklist-натият адрес НЕ може да получава токени", async function() {
            await token.setBlacklist(addr2.address, true);
            
            await expect(
                token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Recipient is blacklisted");
        });
        
        it("Масов blacklist трябва да работи", async function() {
            await token.setBlacklistBatch(
                [addr1.address, addr2.address, addr3.address],
                true
            );
            
            expect(await token.isBlacklisted(addr1.address)).to.equal(true);
            expect(await token.isBlacklisted(addr2.address)).to.equal(true);
            expect(await token.isBlacklisted(addr3.address)).to.equal(true);
        });
        
        it("НЕ може да blacklist-не owner", async function() {
            await expect(
                token.setBlacklist(owner.address, true)
            ).to.be.revertedWith("Cannot blacklist owner");
        });
    });
    
    // ============================================
    // ТЕСТ 8: 48 ЧАСА TRADING LOCK
    // ============================================
    describe("8. 48 часа trading lock", function() {
        it("НЕ трябва да позволява търговия първите 48 часа", async function() {
            await token.transfer(addr1.address, ethers.parseEther("5000"));
            
            await expect(
                token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Trading locked for 48h");
        });
        
        it("Owner трябва да може да трансферира преди 48 часа", async function() {
            await token.transfer(addr1.address, ethers.parseEther("5000"));
            expect(await token.balanceOf(addr1.address)).to.equal(ethers.parseEther("5000"));
        });
        
        it("След 48 часа търговията трябва да е активна", async function() {
            await token.transfer(addr1.address, ethers.parseEther("5000"));
            
            await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine");
            
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("500"));
            expect(await token.balanceOf(addr2.address)).to.be.gt(0);
        });
    });
    
    // ============================================
    // ТЕСТ 9: BURN ФУНКЦИЯ
    // ============================================
    describe("9. Manual burn функция", function() {
        it("Owner трябва да може да изгаря токени", async function() {
            const initialSupply = await token.totalSupply();
            const burnAmount = ethers.parseEther("10000");
            
            await token.burn(burnAmount);
            
            expect(await token.totalSupply()).to.equal(initialSupply - burnAmount);
        });
        
        it("Само owner може да изгаря токени", async function() {
            await expect(
                token.connect(addr1).burn(ethers.parseEther("100"))
            ).to.be.revertedWith("Not owner");
        });
    });
    
    // ============================================
    // ТЕСТ 10: RESCUE ФУНКЦИИ
    // ============================================
    describe("10. Rescue функции (BNB и токени)", function() {
        it("Трябва да може да получава BNB", async function() {
            const amount = ethers.parseEther("1");
            
            await owner.sendTransaction({
                to: await token.getAddress(),
                value: amount
            });
            
            const balance = await ethers.provider.getBalance(await token.getAddress());
            expect(balance).to.equal(amount);
        });
        
        it("Owner трябва да може да изтегли BNB", async function() {
            const amount = ethers.parseEther("1");
            
            await owner.sendTransaction({
                to: await token.getAddress(),
                value: amount
            });
            
            await token.withdrawBNB();
            
            const balance = await ethers.provider.getBalance(await token.getAddress());
            expect(balance).to.equal(0);
        });
    });
});

// ============================================
// ИНСТРУКЦИИ ЗА ИЗПЪЛНЕНИЕ
// ============================================
/*
1. Инсталирай dependencies:
   npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

2. Създай hardhat.config.js:
   module.exports = {
     solidity: "0.8.20",
     networks: {
       hardhat: {}
     }
   };

3. Пусни тестовете:
   npx hardhat test

4. За coverage:
   npx hardhat coverage

ОЧАКВАНИ РЕЗУЛТАТИ:
✅ Всички тестове трябва да минат (pass)
✅ 0 failing tests
✅ 40+ passing tests
*/