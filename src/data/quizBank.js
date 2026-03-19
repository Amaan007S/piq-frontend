const hashString = (input) => {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const sortDeterministically = (items, seed) =>
  [...items].sort((left, right) => {
    const leftScore = hashString(`${seed}:${String(left)}`);
    const rightScore = hashString(`${seed}:${String(right)}`);

    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }

    return String(left).localeCompare(String(right));
  });

const toConceptId = (value) =>
  String(value)
    .toLowerCase()
    .replace(/^(a|an|the)\s+/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const uniqueValues = (values) => Array.from(new Set(values));

const buildOptionsFromDistractors = (answer, distractors, seed) => {
  const options = sortDeterministically(uniqueValues([answer, ...distractors]), `${seed}:options`);

  if (options.length !== 4 || !options.includes(answer)) {
    throw new Error(`Question options must contain the answer plus three unique distractors for ${seed}`);
  }

  return options;
};

const pickDeterministicDistractors = (bank, answer, seed) =>
  sortDeterministically(bank.filter((item) => item !== answer), `${seed}:distractors`).slice(0, 3);

const buildQuestion = ({ conceptId, question, options, answer, difficulty, topic }) => ({
  conceptId,
  question,
  options,
  correctIndex: options.indexOf(answer),
  difficulty,
  topic,
});

const easyDefinitionFacts = [
  { term: "a blockchain", answer: "A shared digital ledger", distractors: ["A wallet backup phrase", "A private chat app", "A token price chart"], topic: "crypto", conceptId: "blockchain" },
  { term: "a wallet", answer: "A tool that manages crypto keys", distractors: ["A blockchain explorer", "A mining reward", "A validator set"], topic: "crypto", conceptId: "wallet" },
  { term: "a private key", answer: "A secret used to sign transactions", distractors: ["A public receiving address", "A market price alert", "A validator reward"], topic: "crypto", conceptId: "private-key" },
  { term: "a public key", answer: "A shareable key used to receive funds", distractors: ["A secret recovery code", "A gas rebate", "A token burn record"], topic: "crypto", conceptId: "public-key" },
  { term: "a seed phrase", answer: "Backup words used to recover a wallet", distractors: ["A trading password", "A wallet nickname", "A network fee"], topic: "crypto", conceptId: "seed-phrase" },
  { term: "a node", answer: "A computer that relays blockchain data", distractors: ["A token bridge fee", "A hardware wallet PIN", "A stablecoin issuer"], topic: "crypto", conceptId: "node" },
  { term: "a validator", answer: "A participant that confirms blocks", distractors: ["A block explorer page", "A wallet contact list", "A swap interface"], topic: "crypto", conceptId: "validator" },
  { term: "consensus", answer: "A method for ledger agreement", distractors: ["A token logo update", "A wallet color theme", "A price notification"], topic: "crypto", conceptId: "consensus" },
  { term: "a smart contract", answer: "Code that runs automatically on-chain", distractors: ["A hardware wallet cable", "A seed phrase backup", "A fiat bank transfer"], topic: "crypto", conceptId: "smart-contract" },
  { term: "a gas fee", answer: "A fee paid to process a transaction", distractors: ["A wallet recovery tool", "A token ticker symbol", "A staking lock period"], topic: "crypto", conceptId: "gas-fee" },
  { term: "mining", answer: "Using computing power to secure a chain", distractors: ["Recovering a seed phrase", "Reviewing a block explorer", "Changing token names"], topic: "crypto", conceptId: "mining" },
  { term: "staking", answer: "Locking coins to support a network", distractors: ["Posting wallet addresses", "Printing QR codes", "Rotating private keys"], topic: "crypto", conceptId: "staking" },
  { term: "a stablecoin", answer: "A token designed for price stability", distractors: ["A token with random supply", "A wallet-only password", "A mining difficulty rule"], topic: "crypto", conceptId: "stablecoin" },
  { term: "an NFT", answer: "A unique token for digital ownership", distractors: ["A recurring gas fee", "A blockchain node log", "A wallet recovery phrase"], topic: "crypto", conceptId: "nft" },
  { term: "an altcoin", answer: "Any cryptocurrency other than bitcoin", distractors: ["A type of seed phrase", "A validator dashboard", "A stable exchange rate"], topic: "crypto", conceptId: "altcoin" },
  { term: "a cold wallet", answer: "A wallet kept offline", distractors: ["A wallet used only for swaps", "A wallet shown on public screens", "A wallet that mines coins"], topic: "crypto", conceptId: "cold-wallet" },
  { term: "a hot wallet", answer: "A wallet connected to the internet", distractors: ["A wallet stored offline only", "A paper backup card", "A block confirmation count"], topic: "crypto", conceptId: "hot-wallet" },
  { term: "a hash", answer: "A fixed-length output from data", distractors: ["A wallet contact book", "A list of token holders", "A staking payout date"], topic: "crypto", conceptId: "hash" },
  { term: "a block explorer", answer: "A tool for viewing on-chain activity", distractors: ["A wallet recovery wizard", "A validator voting rule", "A token launchpad"], topic: "crypto", conceptId: "block-explorer" },
  { term: "market cap", answer: "Price multiplied by circulating supply", distractors: ["The number of wallet users", "A fixed transaction fee", "A network block time"], topic: "general", conceptId: "market-cap" },
  { term: "fiat money", answer: "Government-issued money", distractors: ["A wallet seed phrase", "A token bridge route", "A staking reward type"], topic: "general", conceptId: "fiat-money" },
  { term: "a testnet", answer: "A blockchain environment for testing", distractors: ["A live payment network", "A cold-storage device", "A private trading group"], topic: "crypto", conceptId: "testnet" },
  { term: "a mainnet", answer: "A live blockchain with real value", distractors: ["A practice-only blockchain", "A wallet support ticket", "A test faucet page"], topic: "crypto", conceptId: "mainnet" },
  { term: "a dApp", answer: "An app built on blockchain rails", distractors: ["A printed seed backup", "A validator penalty rule", "A gas refund form"], topic: "crypto", conceptId: "dapp" },
  { term: "DeFi", answer: "Finance without traditional middlemen", distractors: ["A wallet backup standard", "A mining hardware brand", "A token ticker list"], topic: "crypto", conceptId: "defi" },
  { term: "a liquidity pool", answer: "Tokens locked to enable trades", distractors: ["A wallet backup folder", "A block reward schedule", "A hardware wallet screen"], topic: "crypto", conceptId: "liquidity-pool" },
  { term: "slippage", answer: "The gap between expected and final trade price", distractors: ["A fixed wallet password", "A staking reward timer", "A validator signup"], topic: "crypto", conceptId: "slippage" },
  { term: "a bridge", answer: "A tool for moving assets between chains", distractors: ["A seed phrase scanner", "A token burn chart", "A cold storage room"], topic: "crypto", conceptId: "bridge" },
  { term: "an oracle", answer: "A service that brings outside data on-chain", distractors: ["A wallet import tool", "A mining fan controller", "A token logo file"], topic: "crypto", conceptId: "oracle" },
  { term: "an airdrop", answer: "Tokens distributed to users by criteria", distractors: ["A validator slash event", "A wallet recovery failure", "A permanent gas discount"], topic: "crypto", conceptId: "airdrop" },
  { term: "a token burn", answer: "Permanent removal of tokens from supply", distractors: ["A wallet sign-in prompt", "A new chain launchpad", "A validator hardware check"], topic: "crypto", conceptId: "token-burn" },
  { term: "circulating supply", answer: "Tokens currently available in the market", distractors: ["Future token ideas", "Only burned coins", "A wallet password count"], topic: "general", conceptId: "circulating-supply" },
  { term: "phishing", answer: "A scam that tries to steal sensitive data", distractors: ["A validator upgrade", "A gas estimator", "A token listing page"], topic: "general", conceptId: "phishing" },
  { term: "two-factor authentication", answer: "An extra security step during login", distractors: ["A second wallet address", "A mining reward system", "A block explorer filter"], topic: "general", conceptId: "two-factor-authentication" },
  { term: "peer-to-peer transfer", answer: "A direct transfer between users", distractors: ["A validator committee vote", "A bank-owned chain explorer", "A token burn event"], topic: "general", conceptId: "peer-to-peer-transfer" },
];

const easyNamedFacts = [
  { stem: "What is the native currency of Pi Network?", answer: "Pi", distractors: ["Bitcoin", "Ether", "USDT"], topic: "pi", conceptId: "pi", editorialVariants: ["Pi Network pays in what?", "Which coin belongs to Pi Network?", "Pi Network's native coin is?", "What do Pi users earn in-network?"] },
  { stem: "Which consensus protocol does Pi Network use?", answer: "Stellar Consensus Protocol", distractors: ["Proof of Work", "Proof of Stake", "Delegated Proof of Stake"], topic: "pi", conceptId: "pi-consensus", editorialVariants: ["What consensus model powers Pi Network?", "Pi Network is based on which protocol?", "Which protocol does Pi rely on?", "Pi Network runs on what consensus approach?"] },
  { stem: "Who is the pseudonymous creator of Bitcoin?", answer: "Satoshi Nakamoto", distractors: ["Vitalik Buterin", "Nicolas Kokkalis", "Charles Hoskinson"], topic: "crypto", conceptId: "satoshi-nakamoto", editorialVariants: ["Who created Bitcoin under a pseudonym?", "Bitcoin was introduced by whom?", "Who is tied to Bitcoin's original launch?", "Which name is linked to Bitcoin's creation?"] },
  { stem: "What is the native asset of Ethereum?", answer: "Ether", distractors: ["Bitcoin", "Solana", "XRP"], topic: "crypto", conceptId: "ether", editorialVariants: ["Ethereum's native asset is what?", "What coin belongs to Ethereum itself?", "Which asset powers Ethereum?", "What is Ethereum's built-in asset called?"] },
  { stem: "What is Bitcoin's ticker symbol?", answer: "BTC", distractors: ["ETH", "LTC", "XRP"], topic: "crypto", conceptId: "bitcoin", editorialVariants: ["Bitcoin trades under which ticker?", "What's the market symbol for Bitcoin?", "Which ticker stands for Bitcoin?", "On exchanges, Bitcoin is shown as?"] },
  { stem: "What is Ethereum's ticker symbol?", answer: "ETH", distractors: ["ETC", "BTC", "SOL"], topic: "crypto", conceptId: "ether", editorialVariants: ["Ethereum trades under which ticker?", "What's the market symbol for Ethereum?", "Which ticker stands for Ethereum?", "On exchanges, Ethereum appears as?"] },
  { stem: "What does NFT stand for?", answer: "Non-Fungible Token", distractors: ["New Fungible Token", "Network Fee Ticket", "Non-Finalized Trade"], topic: "crypto", conceptId: "nft", editorialVariants: ["NFT is short for what?", "What does NFT actually mean?", "Expand the term NFT.", "What do the letters NFT stand for?"] },
  { stem: "What kind of asset aims to track one dollar?", answer: "Stablecoin", distractors: ["Meme coin", "Governance token", "Utility token"], topic: "crypto", conceptId: "stablecoin", editorialVariants: ["Which asset type tries to stay near $1?", "What kind of crypto targets price stability?", "Which token type aims to track a dollar?", "What do you call a dollar-pegged token?"] },
  { stem: "Which network uses Pi as its native currency?", answer: "Pi Network", distractors: ["Bitcoin", "Ethereum", "Solana"], topic: "pi", conceptId: "pi-network", editorialVariants: ["Pi belongs to which network?", "Which network's native coin is Pi?", "Pi is used on what network?", "What network is built around Pi?"] },
  { stem: "Which asset is native to Bitcoin?", answer: "Bitcoin", distractors: ["Ether", "USDC", "Solana"], topic: "crypto", conceptId: "bitcoin", editorialVariants: ["Bitcoin's native asset is what?", "Which coin belongs to the Bitcoin network?", "What asset is built into Bitcoin?", "The Bitcoin network uses which native asset?"] },
  { stem: "Which asset is native to Ethereum?", answer: "Ether", distractors: ["Bitcoin", "Polygon", "Tether"], topic: "crypto", conceptId: "ether", editorialVariants: ["Ethereum's native asset is which one?", "Which coin belongs to Ethereum?", "What asset is built into Ethereum?", "The Ethereum network uses which native asset?"] },
  { stem: "Which phrase protects wallet recovery?", answer: "Seed phrase", distractors: ["Public key", "Gas fee", "Block explorer"], topic: "crypto", conceptId: "seed-phrase", editorialVariants: ["What helps you recover a wallet?", "Which phrase restores wallet access?", "What do you need to recover a wallet?", "Which phrase matters most for wallet recovery?"] },
];

const easyPurposeFacts = [
  { stem: "What is a wallet address mainly used for?", answer: "Receiving funds", distractors: ["Signing transactions", "Mining blocks", "Resetting passwords"], topic: "crypto", conceptId: "wallet-address", editorialVariants: ["What is a wallet address mostly for?", "Why do people share a wallet address?", "What do you use a wallet address for?", "A wallet address mainly helps you do what?"] },
  { stem: "Where should a seed phrase be stored?", answer: "Privately offline", distractors: ["In public chat", "On a random website", "Inside a token name"], topic: "general", conceptId: "seed-phrase", editorialVariants: ["Where should you keep a seed phrase?", "What's the safest place for a seed phrase?", "How should a seed phrase be stored?", "Where does a seed phrase belong?"] },
  { stem: "What does a block explorer help you check?", answer: "Transaction status", distractors: ["Phone battery", "Wallet theme", "Avatar rank"], topic: "crypto", conceptId: "block-explorer", editorialVariants: ["What do people check in a block explorer?", "A block explorer is useful for what?", "What can a block explorer confirm?", "Why open a block explorer?"] },
  { stem: "What do testnet coins usually have?", answer: "No real market value", distractors: ["A one-dollar peg", "Guaranteed rewards", "Mainnet voting rights"], topic: "crypto", conceptId: "testnet", editorialVariants: ["Testnet coins are usually worth what?", "What value do testnet coins usually carry?", "How much real value do testnet coins have?", "Testnet coins normally have what market value?"] },
  { stem: "What do mainnet assets usually represent?", answer: "Real value on a live network", distractors: ["Practice-only balances", "Local demo points", "Offline backups"], topic: "crypto", conceptId: "mainnet", editorialVariants: ["Mainnet assets usually represent what?", "What do mainnet tokens normally carry?", "On mainnet, assets usually have what?", "Mainnet balances typically represent what kind of value?"] },
  { stem: "What does 2FA add to login?", answer: "An extra verification step", distractors: ["A second private key", "A lower gas fee", "A new wallet address"], topic: "general", conceptId: "two-factor-authentication", editorialVariants: ["What does 2FA do during login?", "Why does 2FA help when you sign in?", "2FA adds what to a login?", "What extra thing does 2FA require?"] },
  { stem: "What does a phishing message often ask for?", answer: "Your seed phrase or passwords", distractors: ["Your app theme", "Your gas tracker", "Your favorite token"], topic: "general", conceptId: "phishing", editorialVariants: ["What do phishing scams usually try to get?", "A phishing message often wants what?", "What are phishing messages really after?", "What sensitive info do phishing scams chase?"] },
  { stem: "Should a private key stay secret?", answer: "Yes, always", distractors: ["No, share it online", "Only after a trade", "Only on testnet"], topic: "general", conceptId: "private-key", editorialVariants: ["Should anyone else see your private key?", "Is it safe to share a private key?", "How private should a private key stay?", "Your private key should be kept how?"] },
  { stem: "Can a public key be shared?", answer: "Yes, it is meant to be shared", distractors: ["No, never", "Only after staking", "Only through email"], topic: "crypto", conceptId: "public-key", editorialVariants: ["Is a public key safe to share?", "Can you share a public key openly?", "What about sharing a public key?", "A public key is meant to be what?"] },
  { stem: "Which wallet type is best for long-term storage?", answer: "Cold wallet", distractors: ["Hot wallet", "Exchange banner", "Gas tracker"], topic: "crypto", conceptId: "cold-wallet", editorialVariants: ["Which wallet suits long-term storage best?", "For holding long term, which wallet fits best?", "What's best for long-term crypto storage?", "Which wallet is better for long holds?"] },
  { stem: "Which wallet type is best for quick access?", answer: "Hot wallet", distractors: ["Cold wallet", "Paper receipt", "Block explorer"], topic: "crypto", conceptId: "hot-wallet", editorialVariants: ["Which wallet is best for fast access?", "For everyday use, which wallet fits best?", "What wallet is better for quick spending?", "Which wallet is easiest for fast access?"] },
  { stem: "What can staking sometimes earn?", answer: "Rewards", distractors: ["Seed phrases", "Password resets", "Token burns"], topic: "crypto", conceptId: "staking", editorialVariants: ["What can staking earn you?", "Why do some people stake tokens?", "Staking may give you what?", "What might you receive from staking?"] },
  { stem: "What does DeFi often try to remove?", answer: "Traditional intermediaries", distractors: ["Wallet addresses", "Block confirmations", "Token symbols"], topic: "crypto", conceptId: "defi", editorialVariants: ["DeFi tries to cut out what?", "What does DeFi usually reduce?", "DeFi is built to remove which middle layer?", "What does DeFi often work around?"] },
  { stem: "Blockchain records are grouped into what?", answer: "Blocks", distractors: ["Folders", "Profile cards", "Widgets"], topic: "crypto", conceptId: "blockchain", editorialVariants: ["Blockchain records are stored in what?", "What are blockchain entries grouped into?", "A blockchain is built from what units?", "What chunks hold blockchain data?"] },
  { stem: "What does a stablecoin try to reduce?", answer: "Price volatility", distractors: ["Wallet ownership", "Network size", "Block rewards"], topic: "crypto", conceptId: "stablecoin", editorialVariants: ["What does a stablecoin try to smooth out?", "Stablecoins mainly aim to reduce what?", "What problem are stablecoins designed to limit?", "Stablecoins try to cut down what?"] },
  { stem: "What is KYC mainly used for?", answer: "Identity verification", distractors: ["Mining setup", "NFT storage", "Token burning"], topic: "general", conceptId: "kyc", editorialVariants: ["What is KYC mostly for?", "Why do platforms ask for KYC?", "KYC is used to confirm what?", "What does KYC mainly verify?"] },
  { stem: "What does a non-custodial wallet give you?", answer: "Control over your own keys", distractors: ["Guaranteed profits", "Free gas forever", "Automatic recovery by strangers"], topic: "crypto", conceptId: "non-custodial-wallet", editorialVariants: ["What do you get with a non-custodial wallet?", "A non-custodial wallet gives you what control?", "What's the key benefit of non-custodial wallets?", "With a non-custodial wallet, who controls the keys?"] },
  { stem: "What does a custodial wallet usually give up?", answer: "Direct control of private keys", distractors: ["Internet access", "Transaction history", "Token prices"], topic: "crypto", conceptId: "custodial-wallet", editorialVariants: ["What do you give up with a custodial wallet?", "A custodial wallet usually means losing what?", "What's the trade-off in custodial wallets?", "With custodial wallets, what control is reduced?"] },
];

const easyYearFacts = [
  { stem: "In which year was Pi Network launched?", answer: "2019", distractors: ["2017", "2018", "2021"], topic: "pi", conceptId: "pi-network-launch" },
  { stem: "In which year was Bitcoin's white paper published?", answer: "2008", distractors: ["2007", "2009", "2010"], topic: "crypto", conceptId: "bitcoin-whitepaper" },
  { stem: "In which year did the Bitcoin network launch?", answer: "2009", distractors: ["2008", "2010", "2011"], topic: "crypto", conceptId: "bitcoin-launch" },
  { stem: "In which year did Ethereum launch?", answer: "2015", distractors: ["2013", "2014", "2017"], topic: "crypto", conceptId: "ethereum-launch" },
  { stem: "In which year did Ethereum complete the Merge?", answer: "2022", distractors: ["2020", "2021", "2023"], topic: "crypto", conceptId: "ethereum-merge" },
];
const mediumScenarioFacts = [
  { scenario: "You want long-term storage and rarely move your coins.", answer: "Use a cold wallet", topic: "crypto", conceptId: "cold-wallet" },
  { scenario: "You need to make a quick small payment from your phone.", answer: "Use a hot wallet", topic: "crypto", conceptId: "hot-wallet" },
  { scenario: "A message asks for your seed phrase to fix your wallet.", answer: "Ignore it as a scam", topic: "general", conceptId: "phishing" },
  { scenario: "You got a new device and need your old wallet back.", answer: "Recover with your seed phrase", topic: "crypto", conceptId: "seed-phrase" },
  { scenario: "You are unsure whether a payment was confirmed.", answer: "Check a block explorer", topic: "crypto", conceptId: "block-explorer" },
  { scenario: "Network fees are high and your transfer is not urgent.", answer: "Wait for a lower-fee moment", topic: "crypto", conceptId: "gas-fee" },
  { scenario: "You want less price volatility for a short period.", answer: "Use a stablecoin", topic: "crypto", conceptId: "stablecoin" },
  { scenario: "You need the same asset on another blockchain.", answer: "Use a bridge carefully", topic: "crypto", conceptId: "bridge" },
  { scenario: "A smart contract needs real-world price data.", answer: "Use an oracle", topic: "crypto", conceptId: "oracle" },
  { scenario: "Your trade executes at a worse price than expected.", answer: "That is slippage", topic: "crypto", conceptId: "slippage" },
  { scenario: "You are sending funds and want to avoid the wrong network.", answer: "Double-check the address and network", topic: "general", conceptId: "network-check" },
  { scenario: "A wallet asks you to sign a message you do not understand.", answer: "Decline until you verify it", topic: "general", conceptId: "wallet-signature" },
  { scenario: "You want rewards for supporting network security.", answer: "Consider staking", topic: "crypto", conceptId: "staking" },
  { scenario: "A service controls the private keys for your wallet.", answer: "It is custodial", topic: "crypto", conceptId: "custodial-wallet" },
  { scenario: "You want full control over your own keys.", answer: "Use a non-custodial wallet", topic: "crypto", conceptId: "non-custodial-wallet" },
  { scenario: "A trade in a tiny liquidity pool moves the price badly.", answer: "Low liquidity raised price impact", topic: "crypto", conceptId: "liquidity-pool" },
  { scenario: "Many independent machines store the same ledger state.", answer: "That supports decentralization", topic: "general", conceptId: "decentralization" },
  { scenario: "You need to check whether a token approval is still active.", answer: "Review wallet approvals", topic: "crypto", conceptId: "token-approval" },
  { scenario: "You want to keep a wallet safer from online attacks.", answer: "Keep it offline when possible", topic: "general", conceptId: "wallet-security" },
  { scenario: "You need proof that a transaction reached the chain.", answer: "Look up the transaction hash", topic: "crypto", conceptId: "transaction-hash" },
  { scenario: "You want a wallet that still works if an exchange freezes.", answer: "Hold your own keys", topic: "crypto", conceptId: "self-custody" },
  { scenario: "A token price feed looks suspicious inside a DeFi app.", answer: "Question the oracle data", topic: "crypto", conceptId: "oracle" },
  { scenario: "You want practice coins for testing features.", answer: "Use a testnet faucet", topic: "crypto", conceptId: "testnet" },
  { scenario: "A swap preview shows a worse rate than expected.", answer: "Check slippage and liquidity", topic: "crypto", conceptId: "slippage-liquidity" },
  { scenario: "A site claims it needs your private key to help you.", answer: "Leave immediately", topic: "general", conceptId: "private-key" },
];

const mediumComparisonFacts = [
  { left: "a private key", right: "a public key", answer: "A private key signs, while a public key receives", topic: "crypto", conceptId: "private-vs-public-key" },
  { left: "a hot wallet", right: "a cold wallet", answer: "A hot wallet is online, while a cold wallet is offline", topic: "crypto", conceptId: "hot-vs-cold-wallet" },
  { left: "testnet", right: "mainnet", answer: "Testnet is for testing, while mainnet carries real value", topic: "crypto", conceptId: "testnet-vs-mainnet" },
  { left: "a coin", right: "a token", answer: "A coin has its own chain, while a token lives on another chain", topic: "crypto", conceptId: "coin-vs-token" },
  { left: "market cap", right: "price", answer: "Market cap includes supply, while price is per unit", topic: "general", conceptId: "market-cap-vs-price" },
  { left: "staking", right: "mining", answer: "Staking locks coins, while mining uses computing power", topic: "crypto", conceptId: "staking-vs-mining" },
  { left: "a custodial wallet", right: "a non-custodial wallet", answer: "Custodial means a service holds keys, non-custodial means you do", topic: "crypto", conceptId: "custodial-vs-non-custodial" },
  { left: "circulating supply", right: "max supply", answer: "Circulating supply is live now, max supply is the cap", topic: "general", conceptId: "circulating-vs-max-supply" },
  { left: "a seed phrase", right: "a password", answer: "A seed phrase recovers the wallet, while a password unlocks an app", topic: "general", conceptId: "seed-phrase-vs-password" },
  { left: "a bridge", right: "a swap", answer: "A bridge moves assets across chains, while a swap exchanges assets", topic: "crypto", conceptId: "bridge-vs-swap" },
  { left: "a validator", right: "a node", answer: "A validator helps finalize blocks, while a node relays data", topic: "crypto", conceptId: "validator-vs-node" },
  { left: "a stablecoin", right: "a volatile token", answer: "A stablecoin aims for price stability, while a volatile token can swing freely", topic: "crypto", conceptId: "stablecoin-vs-volatile-token" },
  { left: "fiat", right: "crypto", answer: "Fiat is state-issued money, while crypto is secured on a blockchain", topic: "general", conceptId: "fiat-vs-crypto" },
  { left: "a block explorer", right: "a wallet", answer: "An explorer views chain data, while a wallet manages keys", topic: "crypto", conceptId: "explorer-vs-wallet" },
  { left: "a gas fee", right: "the amount sent", answer: "Gas pays the network, while the sent amount goes to the recipient", topic: "crypto", conceptId: "gas-fee-vs-send-amount" },
  { left: "self-custody", right: "exchange custody", answer: "Self-custody means you hold keys, exchange custody means the platform does", topic: "crypto", conceptId: "self-vs-exchange-custody" },
  { left: "a public address", right: "a seed phrase", answer: "An address can be shared, while a seed phrase must stay private", topic: "general", conceptId: "address-vs-seed-phrase" },
  { left: "liquidity", right: "slippage", answer: "Lower liquidity often leads to higher slippage", topic: "crypto", conceptId: "liquidity-vs-slippage" },
  { left: "a block", right: "a transaction", answer: "A block contains many transactions", topic: "crypto", conceptId: "block-vs-transaction" },
  { left: "KYC", right: "2FA", answer: "KYC verifies identity, while 2FA adds login security", topic: "general", conceptId: "kyc-vs-2fa" },
];

const hardNuanceFacts = [
  { term: "impermanent loss", answer: "Pool value can lag simple holding when prices diverge", topic: "crypto", conceptId: "impermanent-loss" },
  { term: "slashing", answer: "A validator can lose stake for misbehavior or downtime", topic: "crypto", conceptId: "slashing" },
  { term: "finality", answer: "It is the point where reversal becomes very unlikely", topic: "crypto", conceptId: "finality" },
  { term: "the UTXO model", answer: "Funds are tracked as unspent outputs", topic: "crypto", conceptId: "utxo-model" },
  { term: "the account model", answer: "Balances are tracked per account or address", topic: "crypto", conceptId: "account-model" },
  { term: "a nonce", answer: "An ordered counter that helps prevent replay and duplicates", topic: "crypto", conceptId: "nonce" },
  { term: "MEV", answer: "Profit from ordering, inserting, or censoring transactions", topic: "crypto", conceptId: "mev" },
  { term: "front-running", answer: "Placing a transaction ahead to benefit from an expected move", topic: "crypto", conceptId: "front-running" },
  { term: "token approval", answer: "Permission for a contract to spend tokens from your wallet", topic: "crypto", conceptId: "token-approval" },
  { term: "revoking approval", answer: "Reducing or removing a contract's spend access", topic: "crypto", conceptId: "revoke-approval" },
  { term: "low liquidity", answer: "It causes larger price impact on trades", topic: "crypto", conceptId: "low-liquidity" },
  { term: "smart contract risk", answer: "Code bugs can lock or drain funds", topic: "crypto", conceptId: "smart-contract-risk" },
  { term: "bridge risk", answer: "Security also depends on another chain or contract", topic: "crypto", conceptId: "bridge-risk" },
  { term: "oracle manipulation", answer: "Bad external data can break protocol decisions", topic: "crypto", conceptId: "oracle-manipulation" },
  { term: "self-custody", answer: "The user carries recovery responsibility", topic: "general", conceptId: "self-custody" },
  { term: "a token burn", answer: "Lower supply alone does not guarantee a price increase", topic: "general", conceptId: "token-burn" },
  { term: "market cap", answer: "It is not the same as available cash or liquidity", topic: "general", conceptId: "market-cap" },
  { term: "a failed transaction", answer: "It can still consume gas because computation ran", topic: "crypto", conceptId: "failed-transaction" },
  { term: "seed phrase exposure", answer: "It can compromise every wallet derived from it", topic: "general", conceptId: "seed-phrase-exposure" },
  { term: "confirmations", answer: "More confirmations usually reduce reversal risk", topic: "crypto", conceptId: "confirmations" },
  { term: "a bridge", answer: "Moving chains can add extra trust assumptions", topic: "crypto", conceptId: "bridge" },
  { term: "gas estimation", answer: "A low estimate can cause a transaction to fail", topic: "crypto", conceptId: "gas-estimation" },
  { term: "a stablecoin", answer: "Its peg can break under stress", topic: "crypto", conceptId: "stablecoin" },
  { term: "wallet recovery", answer: "Without backups, self-custody can become permanent loss", topic: "general", conceptId: "wallet-recovery" },
  { term: "token approvals", answer: "Old approvals can remain risky until revoked", topic: "crypto", conceptId: "token-approvals" },
];
const trimQuestionMark = (value) => String(value).replace(/\?$/, "").trim();

const scenarioDistractorBanks = {
  crypto: [
    "Share your recovery phrase",
    "Skip the network check",
    "Approve first, verify later",
    "Send before checking details",
    "Use any chain and hope",
    "Ignore wallet security",
  ],
  general: [
    "Trust the message instantly",
    "Skip the warning",
    "Share sensitive details",
    "Guess and continue",
    "Click first, verify later",
    "Turn off security checks",
  ],
};

const comparisonDistractorBanks = {
  crypto: [
    "They work the same way",
    "One completely replaces the other",
    "Both are only for miners",
    "Neither affects real transactions",
    "They matter only on exchanges",
    "They are just different labels",
  ],
  general: [
    "They mean the same thing",
    "One always makes the other useless",
    "Both are just app settings",
    "Neither affects security",
    "They only matter to traders",
    "They are marketing terms only",
  ],
};

const nuanceDistractorBanks = {
  crypto: [
    "It removes the need for caution",
    "It guarantees profit",
    "It matters only on testnet",
    "It has no real downside",
    "It always lowers costs",
    "It can be ignored safely",
  ],
  general: [
    "It can be ignored safely",
    "It always improves outcomes",
    "It only affects beginners",
    "It removes the need for backups",
    "It matters only once",
    "It has no real risk",
  ],
};

const createDefinitionQuestions = (facts, difficulty) =>
  facts.flatMap(({ term, answer, distractors, topic, conceptId }) => [
    buildQuestion({
      conceptId: conceptId ?? toConceptId(term),
      question: `What's ${term}?`,
      options: buildOptionsFromDistractors(answer, distractors, `${term}:def:1`),
      answer,
      difficulty,
      topic,
    }),
    buildQuestion({
      conceptId: conceptId ?? toConceptId(term),
      question: `${term} means:`,
      options: buildOptionsFromDistractors(answer, distractors, `${term}:def:2`),
      answer,
      difficulty,
      topic,
    }),
    buildQuestion({
      conceptId: conceptId ?? toConceptId(term),
      question: `Pick the best meaning of ${term}.`,
      options: buildOptionsFromDistractors(answer, distractors, `${term}:def:3`),
      answer,
      difficulty,
      topic,
    }),
    buildQuestion({
      conceptId: conceptId ?? toConceptId(term),
      question: `In plain words, ${term} is:`,
      options: buildOptionsFromDistractors(answer, distractors, `${term}:def:4`),
      answer,
      difficulty,
      topic,
    }),
  ]);

const createFactQuestions = (facts, difficulty, prefix) =>
  facts.flatMap(({ stem, answer, distractors, topic, conceptId, editorialVariants }) => {
    const base = trimQuestionMark(stem);
    const prompts = editorialVariants ?? [
      stem,
      `Quick one: ${base}?`,
      `Know this one: ${base}?`,
      `Fast check: ${base}?`,
    ];

    return prompts.map((prompt, index) =>
      buildQuestion({
        conceptId: conceptId ?? toConceptId(answer),
        question: prompt,
        options: buildOptionsFromDistractors(answer, distractors, `${prefix}:${stem}:${index + 1}`),
        answer,
        difficulty,
        topic,
      })
    );
  });

const createScenarioQuestions = (facts, difficulty) =>
  facts.flatMap(({ scenario, answer, topic, conceptId }) => {
    const prompt = String(scenario).replace(/\.$/, "");
    const distractors = pickDeterministicDistractors(
      scenarioDistractorBanks[topic] ?? scenarioDistractorBanks.crypto,
      answer,
      scenario
    );

    return [
      buildQuestion({
        conceptId: conceptId ?? toConceptId(answer),
        question: `${prompt}. Best move?`,
        options: buildOptionsFromDistractors(answer, distractors, `${scenario}:scenario:1`),
        answer,
        difficulty,
        topic,
      }),
      buildQuestion({
        conceptId: conceptId ?? toConceptId(answer),
        question: `${prompt}. What would you do?`,
        options: buildOptionsFromDistractors(answer, distractors, `${scenario}:scenario:2`),
        answer,
        difficulty,
        topic,
      }),
      buildQuestion({
        conceptId: conceptId ?? toConceptId(answer),
        question: `${prompt}. What's the smart call?`,
        options: buildOptionsFromDistractors(answer, distractors, `${scenario}:scenario:3`),
        answer,
        difficulty,
        topic,
      }),
      buildQuestion({
        conceptId: conceptId ?? toConceptId(answer),
        question: `${prompt}. Which choice fits best?`,
        options: buildOptionsFromDistractors(answer, distractors, `${scenario}:scenario:4`),
        answer,
        difficulty,
        topic,
      }),
    ];
  });

const createComparisonQuestions = (facts, difficulty) =>
  facts.flatMap(({ left, right, answer, topic, conceptId }) => {
    const distractors = pickDeterministicDistractors(
      comparisonDistractorBanks[topic] ?? comparisonDistractorBanks.crypto,
      answer,
      `${left}:${right}`
    );

    return [
      buildQuestion({
        conceptId: conceptId ?? toConceptId(`${left}-${right}`),
        question: `${left} vs ${right}: key difference?`,
        options: buildOptionsFromDistractors(answer, distractors, `${left}:${right}:compare:1`),
        answer,
        difficulty,
        topic,
      }),
      buildQuestion({
        conceptId: conceptId ?? toConceptId(`${left}-${right}`),
        question: `How are ${left} and ${right} different?`,
        options: buildOptionsFromDistractors(answer, distractors, `${left}:${right}:compare:2`),
        answer,
        difficulty,
        topic,
      }),
      buildQuestion({
        conceptId: conceptId ?? toConceptId(`${left}-${right}`),
        question: `What's true about ${left} and ${right}?`,
        options: buildOptionsFromDistractors(answer, distractors, `${left}:${right}:compare:3`),
        answer,
        difficulty,
        topic,
      }),
      buildQuestion({
        conceptId: conceptId ?? toConceptId(`${left}-${right}`),
        question: `Pick the best take on ${left} and ${right}.`,
        options: buildOptionsFromDistractors(answer, distractors, `${left}:${right}:compare:4`),
        answer,
        difficulty,
        topic,
      }),
    ];
  });

const createNuanceQuestions = (facts, difficulty) =>
  facts.flatMap(({ term, answer, topic, conceptId }) => {
    const distractors = pickDeterministicDistractors(
      nuanceDistractorBanks[topic] ?? nuanceDistractorBanks.crypto,
      answer,
      term
    );

    return [
      buildQuestion({
        conceptId: conceptId ?? toConceptId(term),
        question: `What's the tricky part about ${term}?`,
        options: buildOptionsFromDistractors(answer, distractors, `${term}:nuance:1`),
        answer,
        difficulty,
        topic,
      }),
      buildQuestion({
        conceptId: conceptId ?? toConceptId(term),
        question: `Which take on ${term} is right?`,
        options: buildOptionsFromDistractors(answer, distractors, `${term}:nuance:2`),
        answer,
        difficulty,
        topic,
      }),
      buildQuestion({
        conceptId: conceptId ?? toConceptId(term),
        question: `What's true about ${term}?`,
        options: buildOptionsFromDistractors(answer, distractors, `${term}:nuance:3`),
        answer,
        difficulty,
        topic,
      }),
      buildQuestion({
        conceptId: conceptId ?? toConceptId(term),
        question: `Pick the best read on ${term}.`,
        options: buildOptionsFromDistractors(answer, distractors, `${term}:nuance:4`),
        answer,
        difficulty,
        topic,
      }),
    ];
  });

const rawQuizBank = [
  ...createDefinitionQuestions(easyDefinitionFacts, "easy"),
  ...createFactQuestions(easyNamedFacts, "easy", "named"),
  ...createFactQuestions(easyPurposeFacts, "easy", "purpose"),
  ...createFactQuestions(easyYearFacts, "easy", "year"),
  ...createScenarioQuestions(mediumScenarioFacts, "medium"),
  ...createComparisonQuestions(mediumComparisonFacts, "medium"),
  ...createNuanceQuestions(hardNuanceFacts, "hard"),
].map((question, index) => ({ id: `quiz-${index + 1}`, ...question }));

if (rawQuizBank.length < 500) {
  throw new Error(`quizBank must contain at least 500 questions. Found ${rawQuizBank.length}.`);
}

export const DAILY_QUIZ_DISTRIBUTION = {
  easy: 7,
  medium: 2,
  hard: 1,
};

export const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const getDailySeed = (date = new Date()) => getLocalDateKey(date).replaceAll("-", "");

const sortQuestions = (items, seed, salt) =>
  [...items].sort((left, right) => {
    const leftScore = hashString(`${seed}:${salt}:${left.id}`);
    const rightScore = hashString(`${seed}:${salt}:${right.id}`);

    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }

    return left.id.localeCompare(right.id);
  });

const selectUniqueQuestions = (items, count, seed, salt, usedConceptIds) => {
  const buckets = new Map();

  sortQuestions(items, seed, `${salt}:pool`).forEach((item) => {
    if (usedConceptIds.has(item.conceptId)) {
      return;
    }

    if (!buckets.has(item.conceptId)) {
      buckets.set(item.conceptId, []);
    }

    buckets.get(item.conceptId).push(item);
  });

  const conceptIds = sortDeterministically([...buckets.keys()], `${seed}:${salt}:concepts`).slice(0, count);

  if (conceptIds.length < count) {
    throw new Error(`Not enough unique ${salt} concepts to build the daily quiz.`);
  }

  const selected = conceptIds.map((conceptId) =>
    sortQuestions(buckets.get(conceptId), seed, `${salt}:${conceptId}`)[0]
  );

  selected.forEach((item) => usedConceptIds.add(item.conceptId));
  return selected;
};

export const quizBank = rawQuizBank.map(({ id, question, options, correctIndex, difficulty, topic }) => ({
  id,
  question,
  options,
  correctIndex,
  difficulty,
  topic,
}));

export const getDailyQuiz = (date = new Date()) => {
  const seed = getDailySeed(date);
  const usedConceptIds = new Set();

  const easy = rawQuizBank.filter((question) => question.difficulty === "easy");
  const medium = rawQuizBank.filter((question) => question.difficulty === "medium");
  const hard = rawQuizBank.filter((question) => question.difficulty === "hard");

  const selection = [
    ...selectUniqueQuestions(easy, DAILY_QUIZ_DISTRIBUTION.easy, seed, "easy", usedConceptIds),
    ...selectUniqueQuestions(medium, DAILY_QUIZ_DISTRIBUTION.medium, seed, "medium", usedConceptIds),
    ...selectUniqueQuestions(hard, DAILY_QUIZ_DISTRIBUTION.hard, seed, "hard", usedConceptIds),
  ];

  return sortQuestions(selection, seed, "final-order").map(
    ({ id, question, options, correctIndex, difficulty, topic }) => ({
      id,
      question,
      options,
      correctIndex,
      difficulty,
      topic,
    })
  );
};


