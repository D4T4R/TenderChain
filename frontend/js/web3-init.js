(function(){
  async function initWeb3() {
    if (!window.ethereum && !window.web3) {
      throw new Error("No Ethereum provider found. Please install MetaMask.");
    }
    if (window.ethereum) {
      window.web3 = new Web3(window.ethereum);
      try { await window.ethereum.request({ method: 'eth_requestAccounts' }); } catch (e) {}
    } else if (window.web3) {
      window.web3 = new Web3(window.web3.currentProvider);
    }

    const netId = await window.web3.eth.net.getId();

    async function loadArtifact(name){
      const res = await fetch(`build/contracts/${name}.json`);
      const json = await res.json();
      const networks = json.networks || {};
      const network = networks[String(netId)] || networks[netId] || null;
      const address = network && network.address ? network.address : null;
      return { name, abi: json.abi, address };
    }

    const names = [
      'FactoryTender','FactoryContract','FactoryGovernmentOfficer','FactoryContractor',
      'TenderRepo','GovernmentOfficerRepo','ContractRepo','ContractorRepo',
      'Tender','Contract','Contractor','GovernmentOfficer','Verifier'
    ];

    const artifacts = await Promise.all(names.map(loadArtifact));
    const Contracts = {};

    artifacts.forEach(a => {
      if (!a || !a.abi) return;
      let instance = null;
      try {
        if (a.address) {
          if (window.web3.eth && typeof window.web3.eth.contract === 'function') {
            const C = window.web3.eth.contract(a.abi);
            instance = C.at(a.address);
          } else {
            instance = new window.web3.eth.Contract(a.abi, a.address);
          }
        }
      } catch (e) {}
      Contracts[a.name] = { abi: a.abi, address: a.address, instance };
    });

    window.Contracts = Contracts;
    const accounts = await window.web3.eth.getAccounts();
    const selected = accounts && accounts[0] ? accounts[0] : '';
    const acctEl = document.getElementById('connected-account');
    if (acctEl) {
      acctEl.textContent = selected ? `${selected.slice(0,6)}...${selected.slice(-4)}` : 'Not connected';
    }
    return { netId, accounts, Contracts };
  }

  window.initWeb3 = initWeb3;
})();
