// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const usdtMock = buildModule("usdtMock", (m) => {

  const usdtMock = m.contract("usdtMock", [], {

  });

  return { usdtMock };
});

export default usdtMock;
