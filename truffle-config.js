module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*" // accept any network id from local Ganache
    },
    rpc: {
      host: "localhost",
      gas: 5000000,
      port: 8545
    }
  },
  compilers: {
    solc: {
      version: "0.8.16",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
        viaIR: true
      }
    }
  }
};
