const ethers = require('ethers')
const dotenv = require('dotenv')

dotenv.config()

const provider = new ethers.providers.WebSocketProvider(process.env.INFURA_URL)
const wallet = ethers.Wallet.fromMnemonic(process.env.MNEMONIC)
const account = wallet.connect(provider)
const factory = new ethers.Contract(
  process.env.ADDRESSES.factory,
  ['event PairCreated(address indexed token0, address indexed token1, address pair, uint)'],
  account

)
const router = new ethers.Contract(
  process.env.ADDRESSES.router,
  [
    'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
    'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
  ],
  account
)

factory.on('PairCreated', async (token0, token1, pairAddress) => {
  console.log(`
    New pair detected
    =================
    token0: ${token0}
    token1: ${token1}
    pairAddress: ${pairAddress}
  `)

  //The token used to pay needs to be WETH
  let tokenIn, tokenOut
  if(token0 === process.env.ADDRESSES.TOKEN) {
    tokenIn = token0
    tokenOut = token1
  }

  if(token1 === process.env.ADDRESSES.TOKEN) {
    tokenIn = token1
    tokenOut = token0
  }

  //If it is not WETH
  if(typeof tokenIn === 'undefined') {
    return
  }

  //Swap AMOUNT_TO_SWAP WETH for new token
  const amountIn = ethers.utils.parseUnits(process.env.AMOUNT_TO_SWAP, 'ether')
  const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut])
  //set slippage
  const amountOutMin = amounts[1].sub(amounts[1].div(10))
  console.log(`
    Buying new token
    ================
    tokenIn: ${amountIn.toString()} ${tokenIn} (${process.env.TOKEN_TICKER})
    tokenOut: ${amountOutMin.toString()} ${tokenOut}
  `)
  const tx = await router.swapExactTokensForTokens(
    amountIn,
    amountOutMin,
    [tokenIn, tokenOut],
    process.env.ADDRESSES.recipient,
    Date.now() + 1000 * 60 * 10 // 10 minute max tx timeout
  )
  const receipt = await tx.wait()
  console.log(`tx receipt\n${receipt}`)
})
