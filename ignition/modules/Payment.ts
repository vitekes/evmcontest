// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const Payments = buildModule("Payments", (m) => {

  const Payments = m.contract("Payments", [], {

  });

  return { Payments };
});

export default Payments;
