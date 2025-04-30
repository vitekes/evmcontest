import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import 'dotenv/config'

const { PRIVATE_KEY } = process.env;
const { BSC_TESTNET_URL,POLYGON_URL,MUMBAI_URL,ETH_URL } = process.env;
const { BSC_API } = process.env;
const config: HardhatUserConfig = {
  solidity:{
    version:"0.8.28",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 1,
      }
    }
  },

  networks:{
    testnet:{
      url:"https://bsc-testnet-rpc.publicnode.com",
      accounts:[`0x${PRIVATE_KEY}`]
    },
    polygon:{
      url:POLYGON_URL,
      accounts:[`0x${PRIVATE_KEY}`]
    },
    eth:{
      url:ETH_URL,
      accounts:[`0x${PRIVATE_KEY}`]
    },
    mumbai:{
      url:MUMBAI_URL,
      accounts:[`0x${PRIVATE_KEY}`]
    }
  },
  etherscan:{
      apiKey: BSC_API
  }
};

export default config;
