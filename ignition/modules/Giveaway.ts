// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const Giveaways = buildModule("Giveaways", (m) => {
  const Payment = "0x2C86fE3Ad93cB678B27D64E941a62b03C6500033" // <- изменить на свой 
  const Giveaways = m.contract("Giveaways", [Payment], {

  });

  return { Giveaways };
});

export default Giveaways;
