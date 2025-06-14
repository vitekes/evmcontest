# Usage guide

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start a local Hardhat node:
   ```bash
   npx hardhat node &
   ```
3. Deploy contracts locally:
   ```bash
   npm run deploy:local
   ```
4. Run tests if needed:
   ```bash
   npm run test
   ```

Before deploying to public networks create a `.env` file based on `env-example.js`.

## Deploying to testnets

Set the required RPC URL and private key in `.env`:
```bash
PRIVATE_KEY=0xabc...
SEPOLIA_RPC=https://sepolia.infura.io/v3/KEY
```
Then deploy:
```bash
npm run deploy:sepolia
```

The script in `ignition/modules/PublicDeploy.ts` handles core contract deployment and links the modules.

## Interacting with contracts

After deployment you can create a contest from a script or Hardhat console:
```javascript
const factory = await ethers.getContract('ContestFactory');
await factory.createContest({
  token: tokenAddress,
  totalPrize: ethers.parseEther('10'),
  template: 0, // see PrizeTemplates
  customDistribution: [],
  jury: [juryAddress],
  startTime: Math.floor(Date.now()/1000),
  endTime: Math.floor(Date.now()/1000) + 86400,
  contestMetadata: 'ipfs://Qm...',
  hasNonMonetaryPrizes: false
});
```

After the contest ends a jury member declares the winners:
```javascript
const escrow = await ethers.getContractAt('ContestEscrow', escrowAddress);
await escrow.declareWinners([winner1, winner2], [1, 2]);
```
Each winner then calls `claimPrize` on the escrow to receive funds.
